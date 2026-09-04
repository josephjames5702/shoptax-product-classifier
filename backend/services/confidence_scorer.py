"""
Multi-Signal Classification Confidence Scorer.
Computes weighted classification confidence score (0.0 to 1.0) and auditable evidence codes.
Design is non-probabilistic, ready for future gold-standard dataset calibration.
"""

from typing import Dict, Any, List, Tuple
from django.conf import settings

DEFAULT_WEIGHTS = {
    'semantic_similarity': 0.25,
    'lexical_match': 0.15,
    'hierarchical_consistency': 0.15,
    'llm_reranker_score': 0.20,
    'attribute_consistency': 0.10,
    'image_evidence': 0.10,
    'data_completeness': 0.05,
}

DEFAULT_THRESHOLDS = {
    'HIGH': 0.85,
    'MEDIUM': 0.60,
}


class ConfidenceScorer:
    def __init__(self, custom_weights: Dict[str, float] = None, custom_thresholds: Dict[str, float] = None):
        self.weights = custom_weights or getattr(settings, 'CONFIDENCE_WEIGHTS', DEFAULT_WEIGHTS)
        self.thresholds = custom_thresholds or getattr(settings, 'CONFIDENCE_THRESHOLDS', DEFAULT_THRESHOLDS)

    def calculate_score(
        self,
        retrieval_candidate: Dict[str, Any],
        ai_result: Dict[str, Any],
        extracted_attributes: List[Dict[str, Any]],
        product_data: Dict[str, Any],
        image_status: str = "NO_IMAGE"
    ) -> Tuple[float, str, Dict[str, float], List[str]]:
        """
        Computes composite score (0.0 to 1.0), confidence level, signal breakdown, and evidence codes.
        """
        # Signal 1: Semantic similarity (0.0 to 1.0)
        s_sem = min(1.0, max(0.0, float(retrieval_candidate.get('final_retrieval_score', 0.5) * 10.0)))

        # Signal 2: Lexical match (0.0 to 1.0)
        title = str(product_data.get('title') or '').lower()
        cat_name = str(retrieval_candidate.get('name') or '').lower()
        s_lex = 1.0 if cat_name in title else (0.75 if any(w in title for w in cat_name.split() if len(w) > 2) else 0.40)

        # Signal 3: Hierarchical consistency (0.0 to 1.0)
        s_hier = 1.0 if retrieval_candidate.get('is_leaf') else 0.70

        # Signal 4: LLM reranker score (0.0 to 1.0)
        s_llm = min(1.0, max(0.0, float(ai_result.get('reranker_confidence', 0.80))))

        # Signal 5: Attribute consistency (0.0 to 1.0)
        if extracted_attributes:
            valid_count = sum(1 for a in extracted_attributes if a.get('is_valid_taxonomy_value'))
            s_attr = valid_count / len(extracted_attributes)
        else:
            s_attr = 0.80

        # Signal 6: Image evidence (0.0 to 1.0)
        if image_status == "VALID":
            s_img = 1.0 if not ai_result.get('has_image_conflict') else 0.40
        elif image_status == "NO_IMAGE":
            s_img = 0.80
        else: # Image failed / timeout / corrupt
            s_img = 0.70

        # Signal 7: Data completeness (0.0 to 1.0)
        filled_fields = sum(1 for k in ['title', 'description', 'bullets', 'brand', 'product_type', 'materials', 'color'] if product_data.get(k))
        s_comp = min(1.0, filled_fields / 5.0)

        signals_breakdown = {
            'semantic_similarity': round(s_sem, 4),
            'lexical_match': round(s_lex, 4),
            'hierarchical_consistency': round(s_hier, 4),
            'llm_reranker_score': round(s_llm, 4),
            'attribute_consistency': round(s_attr, 4),
            'image_evidence': round(s_img, 4),
            'data_completeness': round(s_comp, 4),
        }

        # Weighted Sum
        composite_score = (
            s_sem * self.weights.get('semantic_similarity', 0.25) +
            s_lex * self.weights.get('lexical_match', 0.15) +
            s_hier * self.weights.get('hierarchical_consistency', 0.15) +
            s_llm * self.weights.get('llm_reranker_score', 0.20) +
            s_attr * self.weights.get('attribute_consistency', 0.10) +
            s_img * self.weights.get('image_evidence', 0.10) +
            s_comp * self.weights.get('data_completeness', 0.05)
        )
        composite_score = round(min(1.0, max(0.0, composite_score)), 4)

        # Confidence Level
        high_t = self.thresholds.get('HIGH', 0.85)
        med_t = self.thresholds.get('MEDIUM', 0.60)

        if composite_score >= high_t:
            confidence_level = "HIGH"
        elif composite_score >= med_t:
            confidence_level = "MEDIUM"
        else:
            confidence_level = "LOW"

        # Evidence Codes
        evidence_codes = []
        if s_lex >= 0.8:
            evidence_codes.append("TITLE_MATCH")
        if s_sem >= 0.7:
            evidence_codes.append("SEMANTIC_MATCH")
        if s_hier >= 0.9:
            evidence_codes.append("HIERARCHY_CONSISTENT")
        if image_status == "VALID" and s_img >= 0.8:
            evidence_codes.append("IMAGE_SUPPORT")
        if s_attr >= 0.9:
            evidence_codes.append("ATTRIBUTE_SUPPORT")
        if s_comp >= 0.8:
            evidence_codes.append("COMPLETE_METADATA")

        return composite_score, confidence_level, signals_breakdown, evidence_codes
