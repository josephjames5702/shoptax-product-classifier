from django.test import TestCase
from services.confidence_service import ConfidenceService
from apps.classification.models import ClassificationResult

class ConfidenceServiceTestCase(TestCase):
    def setUp(self):
        self.service = ConfidenceService()

    def test_high_confidence_calculation(self):
        score, level, status, breakdown = self.service.calculate_confidence(
            semantic_score=0.95,
            lexical_score=0.90,
            hierarchical_consistency=0.95,
            llm_reranker_score=0.95,
            attribute_consistency=1.0,
            image_evidence_score=0.90,
            data_completeness=1.0,
            margin_to_second_alt=0.25,
            has_taxonomy_failure=False,
            has_image_conflict=False
        )

        self.assertGreaterEqual(score, 85.0)
        self.assertEqual(level, ClassificationResult.ConfidenceLevel.HIGH)
        self.assertEqual(status, ClassificationResult.ReviewStatus.APPROVED)
        self.assertFalse(breakdown['review_required'])

    def test_low_confidence_and_manual_review_triggers(self):
        score, level, status, breakdown = self.service.calculate_confidence(
            semantic_score=0.40,
            lexical_score=0.30,
            hierarchical_consistency=0.50,
            llm_reranker_score=0.50,
            attribute_consistency=0.20,
            image_evidence_score=0.30,
            data_completeness=0.15,
            margin_to_second_alt=0.01, # Ambiguous top 2 candidates
            has_taxonomy_failure=True,
            has_image_conflict=False
        )

        self.assertLess(score, 70.0)
        self.assertEqual(level, ClassificationResult.ConfidenceLevel.LOW)
        self.assertEqual(status, ClassificationResult.ReviewStatus.PENDING_REVIEW)
        self.assertTrue(breakdown['review_required'])
        self.assertTrue(len(breakdown['review_reasons']) >= 2)
