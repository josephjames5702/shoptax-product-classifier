from django.db import models
import uuid

class ClassificationRun(models.Model):
    class RunStatus(models.TextChoices):
        RUNNING = 'RUNNING', 'Running'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    catalog = models.ForeignKey('catalogs.Catalog', on_delete=models.CASCADE, related_name='classification_runs')
    model_name = models.CharField(max_length=150, default='hybrid-retrieval-reranker-v1')
    total_items = models.IntegerField(default=0)
    processed_items = models.IntegerField(default=0)
    successful_items = models.IntegerField(default=0)
    failed_items = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=RunStatus.choices, default=RunStatus.RUNNING)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'classification_runs'
        ordering = ['-started_at']

    def __str__(self):
        return f"Run {self.id} for Catalog {self.catalog.name} ({self.status})"


class ClassificationResult(models.Model):
    class ConfidenceLevel(models.TextChoices):
        HIGH = 'HIGH', 'High (>=85%)'
        MEDIUM = 'MEDIUM', 'Medium (60-84%)'
        LOW = 'LOW', 'Low (<60%)'

    class ReviewStatus(models.TextChoices):
        PENDING_REVIEW = 'PENDING_REVIEW', 'Pending Review'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        OVERRIDDEN = 'OVERRIDDEN', 'Overridden'
        RULE_VALIDATED = 'RULE_VALIDATED', 'Rule Validated'
        LOCAL_LLM_APPROVED = 'LOCAL_LLM_APPROVED', 'Local LLM Approved'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.OneToOneField('products.Product', on_delete=models.CASCADE, related_name='classification_result')
    taxonomy_version = models.ForeignKey('taxonomy.TaxonomyVersion', on_delete=models.PROTECT, related_name='classification_results')
    category = models.ForeignKey('taxonomy.TaxonomyCategory', on_delete=models.PROTECT, related_name='classified_products')

    # Confidence metrics (0.0 to 1.0)
    confidence_score = models.FloatField(default=0.0, db_index=True)
    confidence_level = models.CharField(max_length=20, choices=ConfidenceLevel.choices, default=ConfidenceLevel.LOW, db_index=True)
    status = models.CharField(max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.PENDING_REVIEW, db_index=True)
    reviewed_by = models.CharField(max_length=150, blank=True, null=True)
    review_notes = models.TextField(blank=True, default='')

    # Auditable Structured Evidence Signals (No private chain-of-thought stored)
    evidence_codes = models.JSONField(default=list, blank=True)
    bm25_score = models.FloatField(default=0.0)
    semantic_score = models.FloatField(default=0.0)
    rrf_score = models.FloatField(default=0.0)
    hierarchical_score = models.FloatField(default=0.0)
    ai_score = models.FloatField(default=0.0)
    attribute_score = models.FloatField(default=0.0)
    image_score = models.FloatField(default=0.0)
    completeness_score = models.FloatField(default=0.0)

    # Execution Metadata
    was_ai_escalated = models.BooleanField(default=False)
    ai_called = models.BooleanField(default=False)
    ai_mode = models.CharField(max_length=50, blank=True, null=True)
    ai_decision = models.CharField(max_length=50, blank=True, null=True)
    ai_provider = models.CharField(max_length=50, default='local')
    ai_model = models.CharField(max_length=100, blank=True, null=True)
    ai_processing_time = models.FloatField(default=0.0)
    ai_error = models.TextField(blank=True, default='')
    ai_retry_count = models.IntegerField(default=0)
    retrieval_method = models.CharField(max_length=100, default='bm25_semantic_rrf')
    image_status = models.CharField(max_length=50, default='NO_IMAGE')

    # AI and retrieval rationale
    reasoning = models.TextField(blank=True, default='')
    text_evidence = models.TextField(blank=True, default='')
    image_evidence = models.TextField(blank=True, default='')
    signals_breakdown = models.JSONField(default=dict, blank=True)

    model_version = models.CharField(max_length=100, default='v1.0')
    classifier_version = models.CharField(max_length=100, default='hybrid-bm25-vector-rerank')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'classification_results'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['confidence_level']),
            models.Index(fields=['status']),
            models.Index(fields=['confidence_score']),
        ]

    def __str__(self):
        return f"{self.product.title[:30]} -> {self.category.name} ({self.confidence_score:.2f})"


class ClassificationAlternative(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    classification_result = models.ForeignKey(ClassificationResult, on_delete=models.CASCADE, related_name='alternatives')
    category = models.ForeignKey('taxonomy.TaxonomyCategory', on_delete=models.PROTECT, related_name='alternative_results')
    rank = models.IntegerField(default=1)  # 1, 2, 3
    score = models.FloatField(default=0.0)
    reason = models.TextField(blank=True, default='')
    supporting_evidence = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'classification_alternatives'
        ordering = ['classification_result', 'rank']
        unique_together = ('classification_result', 'rank')

    def __str__(self):
        return f"Alt #{self.rank}: {self.category.name} ({self.score:.2f})"


class ExtractedAttribute(models.Model):
    class SourceType(models.TextChoices):
        TEXT = 'TEXT', 'Text'
        IMAGE = 'IMAGE', 'Image'
        STRUCTURED = 'STRUCTURED', 'Structured Field'
        MULTIMODAL = 'MULTIMODAL', 'Multimodal'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    classification_result = models.ForeignKey(ClassificationResult, on_delete=models.CASCADE, related_name='extracted_attributes')
    attribute = models.ForeignKey('taxonomy.TaxonomyAttribute', on_delete=models.PROTECT, related_name='extracted_values')

    raw_value = models.CharField(max_length=500)
    normalized_value = models.CharField(max_length=500, blank=True, default='')
    is_valid_taxonomy_value = models.BooleanField(default=False)
    source = models.CharField(max_length=20, choices=SourceType.choices, default=SourceType.TEXT)
    confidence = models.FloatField(default=1.0)

    class Meta:
        db_table = 'extracted_attributes'
        ordering = ['attribute__name']

    def __str__(self):
        return f"{self.attribute.name}: {self.normalized_value or self.raw_value}"
