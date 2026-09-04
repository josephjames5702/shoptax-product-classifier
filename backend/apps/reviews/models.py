from django.db import models
import uuid

class ReviewDecision(models.Model):
    class ActionType(models.TextChoices):
        APPROVE = 'APPROVE', 'Approve'
        OVERRIDE = 'OVERRIDE', 'Override Category'
        REJECT = 'REJECT', 'Reject'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    classification_result = models.ForeignKey('classification.ClassificationResult', on_delete=models.CASCADE, related_name='review_decisions')
    action = models.CharField(max_length=20, choices=ActionType.choices)
    reviewer = models.CharField(max_length=150, default='system_admin')
    old_category = models.ForeignKey('taxonomy.TaxonomyCategory', on_delete=models.SET_NULL, null=True, blank=True, related_name='overridden_from')
    new_category = models.ForeignKey('taxonomy.TaxonomyCategory', on_delete=models.SET_NULL, null=True, blank=True, related_name='overridden_to')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'review_decisions'
        ordering = ['-created_at']

    def __str__(self):
        return f"Decision: {self.action} on {self.classification_result.product.title[:30]}"
