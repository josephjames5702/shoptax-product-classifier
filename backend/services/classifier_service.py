"""
Product Classification Coordinator Service.
Orchestrates Retrieval, AI Escalation, Deterministic Taxonomy Validation, Attribute Extraction,
Confidence Scoring, and Auditable Evidence Persistence.
"""

import logging
from typing import Dict, Any, Optional
from django.db import transaction
from django.conf import settings

from apps.products.models import Product, ProductImage
from apps.taxonomy.models import TaxonomyVersion, TaxonomyCategory
from apps.classification.models import ClassificationResult, ClassificationAlternative, ExtractedAttribute
from services.retrieval_service import RetrievalService
from services.attribute_extractor import AttributeExtractor
from services.confidence_scorer import ConfidenceScorer
from services.llm_approval_service import LLMApprovalService

logger = logging.getLogger(__name__)


class ClassifierService:
    def __init__(self):
        self.llm_approval = LLMApprovalService()
        self.retrieval_service = RetrievalService.get_instance()
        self.confidence_scorer = ConfidenceScorer()
        self._active_version = TaxonomyVersion.objects.filter(is_active=True).first()

    def get_active_version(self) -> TaxonomyVersion:
        if self._active_version is None:
            self._active_version = TaxonomyVersion.objects.filter(is_active=True).first()
        if not self._active_version:
            raise ValueError("Cannot classify product: No ACTIVE taxonomy version found in database.")
        return self._active_version

    def prepare_classification(
        self,
        product: Product,
        precomputed_vector: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Computes classification, confidence, alternatives and extracted attributes in-memory.
        Does NOT hit the database for writes. Returns prepared data for single or bulk creation.
        """
        active_version = self.get_active_version()

        product_data = {
            'product_number': product.product_number or '',
            'title': product.title or '',
            'description': product.description or '',
            'bullets': product.bullets or '',
            'brand': product.brand or '',
            'product_type': product.product_type or '',
            'materials': product.materials or '',
            'color': product.color or '',
            'dimensions': product.dimensions or '',
        }

        # Handle Image safely without blocking or downloading
        image_status = "NO_IMAGE"
        image_local_path = None
        try:
            # Check if prefetched
            images = getattr(product, '_prefetched_objects_cache', {}).get('images')
            primary_image = images[0] if images else product.images.first()
            if primary_image:
                if primary_image.status == ProductImage.ImageStatus.DOWNLOADED and primary_image.local_path:
                    image_local_path = primary_image.local_path
                    image_status = "VALID"
                elif primary_image.status == ProductImage.ImageStatus.FAILED:
                    image_status = "FAILED"
                else:
                    image_status = "PENDING"
        except Exception:
            image_status = "NO_IMAGE"

        # 4. 3-Stage Candidate Retrieval (BM25 + Semantic + RRF -> Top 10)
        candidates = self.retrieval_service.retrieve_candidates(product_data, top_k_final=10, product_vector=precomputed_vector)
        if not candidates:
            raise ValueError(f"Retrieval engine returned 0 candidates for product ID {product.id}")

        top_cand = candidates[0]
        sem_score = top_cand.get('semantic_similarity_score', 0.0)
        bm25_score = top_cand.get('bm25_score', 0.0)

        # Initial candidate structure
        was_ai_escalated = False
        ai_result = {
            'best_category_id': top_cand['category_id'],
            'best_category': top_cand,
            'alternatives': [
                {'category_id': c['category_id'], 'score': round(c['final_retrieval_score'] * 100, 1), 'reason': 'Hybrid retrieval match'}
                for c in candidates[1:4]
            ],
            'reranker_confidence': min(0.98, top_cand['final_retrieval_score']),
            'reasoning': f"Candidate match '{top_cand['full_path']}' from hybrid BM25 and vector retrieval.",
            'text_evidence': f"Title matches taxonomy tokens: '{product_data['title']}'",
            'image_evidence': f"Image status: {image_status}",
            'extracted_attributes': {},
            'has_image_conflict': False
        }

        # Attribute Extraction (Do this first so LLM can use it later if needed, or deterministic rule uses it)
        extracted_attrs_data = AttributeExtractor.extract_and_match(self.retrieval_service.get_category_by_id(top_cand['category_id']), product_data)

        # Confidence Scoring (Initial deterministic score)
        composite_score, confidence_level, signals_breakdown, evidence_codes = self.confidence_scorer.calculate_score(
            retrieval_candidate=top_cand,
            ai_result={'reranker_confidence': top_cand['final_retrieval_score']},
            extracted_attributes=extracted_attrs_data,
            product_data=product_data,
            image_status=image_status
        )

        # LLM / Deterministic Approval Phase
        llm_decision_data = self.llm_approval.validate_classification(
            product_data=product_data,
            candidates=candidates,
            image_local_path=image_local_path,
            confidence_score=composite_score
        )

        selected_cat_id = llm_decision_data.get('selected_category_id')
        if selected_cat_id:
            try:
                selected_cat_id = int(selected_cat_id)
            except (ValueError, TypeError):
                selected_cat_id = None
        
        candidate_ids = {c['category_id'] for c in candidates}

        validated_category = None
        if selected_cat_id and selected_cat_id in candidate_ids:
            validated_category = self.retrieval_service.get_category_by_id(selected_cat_id)

        if not validated_category:
            validated_category = self.retrieval_service.get_category_by_id(top_cand['category_id'])

        if not validated_category:
            validated_category = TaxonomyCategory.objects.filter(
                taxonomy_version=active_version,
                id=top_cand['category_id']
            ).first()

        if not validated_category:
            raise ValueError("Failed to resolve active TaxonomyCategory instance.")

        ai_decision = llm_decision_data.get('decision')
        ai_mode = llm_decision_data.get('ai_mode')
        
        if ai_decision == 'APPROVED':
            if ai_mode == 'local_llm':
                review_status = ClassificationResult.ReviewStatus.LOCAL_LLM_APPROVED
                new_status = Product.ProcessingStatus.AUTO_APPROVED
            else:
                review_status = ClassificationResult.ReviewStatus.RULE_VALIDATED
                new_status = Product.ProcessingStatus.CLASSIFIED
        elif ai_decision == 'NEEDS_CHANGES':
            review_status = ClassificationResult.ReviewStatus.PENDING_REVIEW
            new_status = Product.ProcessingStatus.REQUIRES_REVIEW
        else:
            review_status = ClassificationResult.ReviewStatus.REJECTED
            new_status = Product.ProcessingStatus.FAILED

        candidates_by_id = {c['category_id']: c for c in candidates}
        alt_data = []
        for rank, alt in enumerate(candidates[1:4], start=1):
            alt_cat_id = alt.get('category_id')
            if (
                alt_cat_id and 
                alt_cat_id != validated_category.id and 
                alt_cat_id in candidates_by_id and
                self.retrieval_service.get_category_by_id(alt_cat_id) is not None
            ):
                alt_data.append({
                    'category_id': alt_cat_id,
                    'rank': rank,
                    'score': float(alt.get('final_retrieval_score', 0.0)),
                    'reason': "Semantic alternative",
                    'supporting_evidence': ""
                })

        result_kwargs = {
            'product': product,
            'taxonomy_version': active_version,
            'category': validated_category,
            'confidence_score': composite_score,
            'confidence_level': confidence_level,
            'status': review_status,
            'evidence_codes': evidence_codes,
            'bm25_score': signals_breakdown['lexical_match'],
            'semantic_score': signals_breakdown['semantic_similarity'],
            'rrf_score': signals_breakdown['hierarchical_consistency'],
            'hierarchical_score': signals_breakdown['hierarchical_consistency'],
            'ai_score': llm_decision_data.get('confidence', 0.0),
            'attribute_score': signals_breakdown['attribute_consistency'],
            'image_score': signals_breakdown['image_evidence'],
            'completeness_score': signals_breakdown['data_completeness'],
            'was_ai_escalated': True,
            'ai_called': llm_decision_data.get('ai_called', False),
            'ai_mode': ai_mode or 'deterministic_local',
            'ai_decision': ai_decision or 'APPROVED',
            'ai_provider': llm_decision_data.get('actual_provider') or 'local_rules',
            'ai_model': llm_decision_data.get('actual_model') or 'none',
            'ai_error': llm_decision_data.get('error', ''),
            'retrieval_method': 'bm25_vector_rrf',
            'image_status': image_status,
            'reasoning': ", ".join(llm_decision_data.get('reason_codes', [])),
            'text_evidence': '',
            'image_evidence': '',
            'signals_breakdown': signals_breakdown,
            'reviewed_by': None,
            'review_notes': '',
        }

        return {
            'product': product,
            'result_kwargs': result_kwargs,
            'alt_data': alt_data,
            'extracted_attrs_data': extracted_attrs_data,
            'review_status': review_status,
            'new_status': new_status,
        }

    def classify_product(
        self,
        product: Product,
        precomputed_vector: Optional[Any] = None
    ) -> ClassificationResult:
        """Single-product classification helper (preserves full compatibility)."""
        prep = self.prepare_classification(product, precomputed_vector=precomputed_vector)
        with transaction.atomic():
            ClassificationResult.objects.filter(product=product).delete()
            result = ClassificationResult.objects.create(**prep['result_kwargs'])

            alts = [
                ClassificationAlternative(
                    classification_result=result,
                    category_id=a['category_id'],
                    rank=a['rank'],
                    score=a['score'],
                    reason=a['reason'],
                    supporting_evidence=a['supporting_evidence']
                )
                for a in prep['alt_data']
            ]
            if alts:
                ClassificationAlternative.objects.bulk_create(alts)

            attrs = [
                ExtractedAttribute(
                    classification_result=result,
                    attribute_id=attr_item['attribute_id'],
                    raw_value=attr_item['raw_value'],
                    normalized_value=attr_item['normalized_value'],
                    is_valid_taxonomy_value=attr_item['is_valid_taxonomy_value'],
                    source=attr_item['source'],
                    confidence=attr_item['confidence']
                )
                for attr_item in prep['extracted_attrs_data']
            ]
            if attrs:
                ExtractedAttribute.objects.bulk_create(attrs)

            product.processing_status = prep['new_status']
            product.save(update_fields=['processing_status'])

        return result

    def classify_batch(
        self,
        products: List[Product],
        precomputed_vectors: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Ultra-fast batch classification executing candidate retrieval, attribute matching,
        and confidence scoring in-memory, followed by atomic bulk database writes.
        """
        prepared_list = []
        for idx, prod in enumerate(products):
            p_vec = precomputed_vectors[idx] if precomputed_vectors is not None and idx < len(precomputed_vectors) else None
            try:
                prep = self.prepare_classification(prod, precomputed_vector=p_vec)
                prepared_list.append(prep)
            except Exception as e:
                logger.exception(f"Error preparing product {prod.id}: {e}")
                prod.processing_status = Product.ProcessingStatus.FAILED
                prod.decision_status = Product.DecisionStatus.ADMIN_DECLINED
                prod.last_error = str(e)
                prod.save(update_fields=['processing_status', 'decision_status', 'last_error'])

        if not prepared_list:
            return []

        # Atomic bulk database write for the entire batch
        with transaction.atomic():
            prod_ids = [item['product'].id for item in prepared_list]
            ClassificationResult.objects.filter(product_id__in=prod_ids).delete()

            # 1. Bulk create ClassificationResult objects
            results_to_create = [
                ClassificationResult(**item['result_kwargs'])
                for item in prepared_list
            ]
            created_results = ClassificationResult.objects.bulk_create(results_to_create)

            # 2. Bulk create alternatives & extracted attributes with parent FK
            alts_to_create = []
            attrs_to_create = []

            for item, res in zip(prepared_list, created_results):
                for a in item['alt_data']:
                    alts_to_create.append(
                        ClassificationAlternative(
                            classification_result=res,
                            category_id=a['category_id'],
                            rank=a['rank'],
                            score=a['score'],
                            reason=a['reason'],
                            supporting_evidence=a['supporting_evidence']
                        )
                    )
                for attr_item in item['extracted_attrs_data']:
                    attrs_to_create.append(
                        ExtractedAttribute(
                            classification_result=res,
                            attribute_id=attr_item['attribute_id'],
                            raw_value=attr_item['raw_value'],
                            normalized_value=attr_item['normalized_value'],
                            is_valid_taxonomy_value=attr_item['is_valid_taxonomy_value'],
                            source=attr_item['source'],
                            confidence=attr_item['confidence']
                        )
                    )

            if alts_to_create:
                ClassificationAlternative.objects.bulk_create(alts_to_create, batch_size=500)
            if attrs_to_create:
                ExtractedAttribute.objects.bulk_create(attrs_to_create, batch_size=500)

            # 3. Bulk update products status
            for item in prepared_list:
                item['product'].processing_status = item['new_status']
                if item['new_status'] in [Product.ProcessingStatus.AUTO_APPROVED, Product.ProcessingStatus.CLASSIFIED]:
                    item['product'].decision_status = Product.DecisionStatus.AUTO_CLASSIFIED
                elif item['new_status'] in [Product.ProcessingStatus.REQUIRES_REVIEW, Product.ProcessingStatus.MANUAL_REVIEW]:
                    item['product'].decision_status = Product.DecisionStatus.REQUIRES_REVIEW
                elif item['new_status'] == Product.ProcessingStatus.FAILED:
                    item['product'].decision_status = Product.DecisionStatus.ADMIN_DECLINED

            Product.objects.bulk_update([item['product'] for item in prepared_list], ['processing_status', 'decision_status'], batch_size=500)

        return prepared_list
