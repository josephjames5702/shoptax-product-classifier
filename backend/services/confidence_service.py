"""
Multi-Signal Application-Level Confidence Scorer and Manual Review Router.
"""

import logging
from typing import Dict, Any, Tuple
from django.conf import settings
from apps.classification.models import ClassificationResult

logger = logging.getLogger(__name__)

class ConfidenceService:
    def __init__(self, weights: Dict[str, float] = None):
        self.weights = weights or getattr(settings, 'CONFIDENCE_WEIGHTS', {
            'semantic_similarity': 0.25,
            'lexical_match': 0.15,
            'hierarchical_consistency': 0.15,
            'llm_reranker_score': 0.20,
            'attribute_consistency': 0.10,
            'image_evidence': 0.10,
            'data_completeness': 0.05,
        })

    def calculate_confidence(
        self,
        semantic_score: float,          # 0.0 to 1.0
        lexical_score: float,           # 0.0 to 1.0
        hierarchical_consistency: float,# 0.0 to 1.0
        llm_reranker_score: float,      # 0.0 to 1.0
        attribute_consistency: float,   # 0.0 to 1.0
        image_evidence_score: float,    # 0.0 to 1.0
        data_completeness: float,       # 0.0 to 1.0
        margin_to_second_alt: float,    # 0.0 to 1.0
        has_taxonomy_failure: bool = False,
        has_image_conflict: bool = False,
    ) -> Tuple[float, str, str, Dict[str, Any]]:
        """
        Calculates multi-signal weighted composite confidence score (0 to 100),
        assigns level (HIGH/MEDIUM/LOW), and determines review status.
        """
        w = self.weights

        # Clamp all inputs to [0.0, 1.0]
        s_sem = max(0.0, min(1.0, float(semantic_score)))
        s_lex = max(0.0, min(1.0, float(lexical_score)))
        s_hie = max(0.0, min(1.0, float(hierarchical_consistency)))
        s_llm = max(0.0, min(1.0, float(llm_reranker_score)))
        s_att = max(0.0, min(1.0, float(attribute_consistency)))
        s_img = max(0.0, min(1.0, float(image_evidence_score)))
        s_cmp = max(0.0, min(1.0, float(data_completeness)))

        raw_composite = (
            w.get('semantic_similarity', 0.25) * s_sem +
            w.get('lexical_match', 0.15) * s_lex +
            w.get('hierarchical_consistency', 0.15) * s_hie +
            w.get('llm_reranker_score', 0.20) * s_llm +
            w.get('attribute_consistency', 0.10) * s_att +
            w.get('image_evidence', 0.10) * s_img +
            w.get('data_completeness', 0.05) * s_cmp
        )

        # Scale to 0 - 100
        score = round(raw_composite * 100.0, 1)

        # Level determination
        if score >= 85.0:
            level = ClassificationResult.ConfidenceLevel.HIGH
        elif score >= 70.0:
            level = ClassificationResult.ConfidenceLevel.MEDIUM
        else:
            level = ClassificationResult.ConfidenceLevel.LOW

        # Manual Review check
        review_required = False
        review_reasons = []

        if score < 70.0:
            review_required = True
            review_reasons.append("Overall confidence score is below 70%")

        if margin_to_second_alt < 0.05 and margin_to_second_alt >= 0:
            review_required = True
            review_reasons.append("Top two candidate categories have ambiguous scores (margin < 5%)")

        if has_taxonomy_failure:
            review_required = True
            review_reasons.append("Taxonomy attribute validation mismatch")

        if has_image_conflict:
            review_required = True
            review_reasons.append("Visual evidence conflicts with textual signals")

        if data_completeness < 0.2:
            review_required = True
            review_reasons.append("Severe missing product metadata (title only / incomplete)")

        review_status = (
            ClassificationResult.ReviewStatus.PENDING_REVIEW 
            if review_required 
            else ClassificationResult.ReviewStatus.APPROVED
        )

        breakdown = {
            'weights': self.weights,
            'scores': {
                'semantic_similarity': round(s_sem * 100, 1),
                'lexical_match': round(s_lex * 100, 1),
                'hierarchical_consistency': round(s_hie * 100, 1),
                'llm_reranker_score': round(s_llm * 100, 1),
                'attribute_consistency': round(s_att * 100, 1),
                'image_evidence': round(s_img * 100, 1),
                'data_completeness': round(s_cmp * 100, 1),
            },
            'composite_score': score,
            'review_required': review_required,
            'review_reasons': review_reasons,
        }

        return score, level, review_status, breakdown
