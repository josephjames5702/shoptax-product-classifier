"""
Classification Service Orchestrator.
Executes the hybrid 15-step classification pipeline for individual products and batches.
"""

import os
import logging
from typing import Dict, Any, Optional
from django.db import transaction
from apps.products.models import Product, ProductImage
from apps.taxonomy.models import TaxonomyVersion, TaxonomyCategory
from apps.classification.models import (
    ClassificationResult,
    ClassificationAlternative,
    ExtractedAttribute,
)
from services.retrieval_service import RetrievalService
from services.ai_providers import get_ai_provider, BaseAIProvider
from services.image_service import ImageService
from services.validation_service import ValidationService
from services.confidence_service import ConfidenceService

logger = logging.getLogger(__name__)

class ClassificationService:
    def __init__(self, ai_provider: Optional[BaseAIProvider] = None):
        self.retrieval_service = RetrievalService.get_instance()
        self.ai_provider = ai_provider or get_ai_provider()
        self.image_service = ImageService()
        self.validation_service = ValidationService()
        self.confidence_service = ConfidenceService()

    def build_canonical_text(self, product: Product) -> str:
        """
        Creates canonical text representation from product fields.
        STRICTLY ENFORCES DATA LEAKAGE PREVENTION:
        Does NOT look at or include 'Product Category' or 'Product Sub Category'.
        """
        parts = []
        if product.title:
            parts.append(f"Title: {product.title}")
        if product.brand:
            parts.append(f"Brand: {product.brand}")
        if product.product_type:
            parts.append(f"Type: {product.product_type}")
        if product.materials:
            parts.append(f"Materials: {product.materials}")
        if product.color:
            parts.append(f"Color: {product.color}")
        if product.description:
            # First 500 chars of clean description
            clean_desc = product.description.replace('\n', ' ').strip()
            parts.append(f"Description: {clean_desc[:500]}")
        if product.bullets:
            clean_bullets = product.bullets.replace('\n', ' ').strip()
            parts.append(f"Bullets: {clean_bullets[:300]}")
        if product.dimensions:
            parts.append(f"Dimensions: {product.dimensions}")
        if product.set_includes:
            parts.append(f"Includes: {product.set_includes[:200]}")

        return " | ".join(parts)

    def calculate_data_completeness(self, product: Product) -> float:
        """
        Calculates how complete the product data is (0.0 to 1.0).
        """
        checks = [
            bool(product.title),
            bool(product.description),
            bool(product.brand),
            bool(product.product_type),
            bool(product.materials),
            bool(product.color),
            bool(product.bullets),
            product.images.exists(),
        ]
        return sum(1 for c in checks if c) / len(checks)

    def classify_product(self, product: Product) -> ClassificationResult:
        """
        Runs the full classification pipeline for a single product with failure isolation.
        """
        product.attempts += 1
        product.processing_status = Product.ProcessingStatus.PROCESSING
        product.save(update_fields=['attempts', 'processing_status'])

        try:
            # 1. Canonical product representation
            canonical_query = self.build_canonical_text(product)
            data_completeness = self.calculate_data_completeness(product)

            # 2. Hybrid Retrieval (BM25 + Dense Vector Search + RRF)
            candidates = self.retrieval_service.retrieve_candidates(canonical_query, top_k=15)
            if not candidates:
                raise ValueError("No candidate categories retrieved from Shopify taxonomy.")

            # 3. Download / Validate primary image if available
            primary_img = product.images.order_by('position').first()
            local_img_path = None
            if primary_img and primary_img.status == ProductImage.ImageStatus.PENDING:
                try:
                    self.image_service.download_and_validate(primary_img)
                    if primary_img.local_path and os.path.exists(os.path.join(self.image_service.media_img_dir, os.path.basename(primary_img.local_path))):
                        local_img_path = os.path.join(self.image_service.media_img_dir, os.path.basename(primary_img.local_path))
                except Exception as img_err:
                    logger.warning(f"Image download failed for product {product.id}: {img_err}")

            # 4. AI / Heuristic Reranker
            product_dict = {
                'title': product.title,
                'description': product.description,
                'bullets': product.bullets,
                'brand': product.brand,
                'product_type': product.product_type,
                'materials': product.materials,
                'color': product.color,
                'dimensions': product.dimensions,
            }

            rerank_result = self.ai_provider.rerank_and_extract(
                product_data=product_dict,
                candidates=candidates,
                image_local_path=local_img_path
            )

            selected_category_id = rerank_result['best_category_id']
            selected_category = TaxonomyCategory.objects.get(id=selected_category_id)

            # 5. Extract & Validate Category-Specific Attributes
            extracted_attrs = self.validation_service.extract_and_validate_attributes(
                product=product,
                category=selected_category,
                ai_extracted_attributes=rerank_result.get('extracted_attributes', {})
            )

            has_tax_failure = any(not a['is_valid_taxonomy_value'] for a in extracted_attrs)
            attr_consistency = sum(1.0 for a in extracted_attrs if a['is_valid_taxonomy_value']) / max(len(extracted_attrs), 1)

            # 6. Multi-Signal Confidence Calculation
            best_cand_data = next((c for c in candidates if c['category_id'] == selected_category_id), candidates[0])
            second_score = candidates[1]['rrf_score'] if len(candidates) > 1 else 0.0
            margin = best_cand_data['rrf_score'] - second_score

            image_evidence_score = 0.90 if local_img_path else 0.50
            if primary_img and primary_img.status in [ProductImage.ImageStatus.FAILED, ProductImage.ImageStatus.INVALID]:
                image_evidence_score = 0.30

            conf_score, conf_level, review_status, breakdown = self.confidence_service.calculate_confidence(
                semantic_score=best_cand_data.get('semantic_score', 0.5),
                lexical_score=best_cand_data.get('bm25_score', 0.5),
                hierarchical_consistency=0.90 if selected_category.is_leaf else 0.70,
                llm_reranker_score=rerank_result.get('reranker_confidence', 0.85),
                attribute_consistency=attr_consistency,
                image_evidence_score=image_evidence_score,
                data_completeness=data_completeness,
                margin_to_second_alt=margin,
                has_taxonomy_failure=has_tax_failure,
                has_image_conflict=rerank_result.get('has_image_conflict', False)
            )

            # 7. Persist Results Atomically
            with transaction.atomic():
                # Remove prior result if retrying
                if hasattr(product, 'classification_result'):
                    product.classification_result.delete()

                result = ClassificationResult.objects.create(
                    product=product,
                    taxonomy_version=selected_category.taxonomy_version,
                    category=selected_category,
                    confidence_score=conf_score,
                    confidence_level=conf_level,
                    status=review_status,
                    reasoning=rerank_result.get('reasoning', ''),
                    text_evidence=rerank_result.get('text_evidence', ''),
                    image_evidence=rerank_result.get('image_evidence', ''),
                    signals_breakdown=breakdown,
                    model_version='hybrid-bm25-vector-rerank-v1',
                )

                # Persist alternatives (top 3)
                alt_objs = []
                for idx, alt in enumerate(rerank_result.get('alternatives', [])[:3], start=1):
                    alt_cat = TaxonomyCategory.objects.filter(id=alt['category_id']).first()
                    if alt_cat:
                        alt_objs.append(
                            ClassificationAlternative(
                                classification_result=result,
                                category=alt_cat,
                                rank=idx,
                                score=alt['score'],
                                reason=alt.get('reason', ''),
                                supporting_evidence=alt.get('evidence', '')
                            )
                        )
                if alt_objs:
                    ClassificationAlternative.objects.bulk_create(alt_objs)

                # Persist extracted attributes
                attr_objs = []
                for ea in extracted_attrs:
                    attr_objs.append(
                        ExtractedAttribute(
                            classification_result=result,
                            attribute=ea['attribute'],
                            raw_value=ea['raw_value'],
                            normalized_value=ea['normalized_value'],
                            is_valid_taxonomy_value=ea['is_valid_taxonomy_value'],
                            source=ea['source'],
                            confidence=ea['confidence'],
                        )
                    )
                if attr_objs:
                    ExtractedAttribute.objects.bulk_create(attr_objs)

                # Update product status
                product.processing_status = (
                    Product.ProcessingStatus.MANUAL_REVIEW
                    if review_status == ClassificationResult.ReviewStatus.PENDING_REVIEW
                    else Product.ProcessingStatus.COMPLETED
                )
                product.last_error = None
                from django.utils import timezone
                product.last_processed_at = timezone.now()
                product.save(update_fields=['processing_status', 'last_error', 'last_processed_at'])

            return result

        except Exception as e:
            logger.exception(f"Classification failed for product {product.id}")
            product.processing_status = Product.ProcessingStatus.FAILED
            product.last_error = str(e)
            from django.utils import timezone
            product.last_processed_at = timezone.now()
            product.save(update_fields=['processing_status', 'last_error', 'last_processed_at'])
            raise e
