from django.db import models
from django.contrib.auth.models import User
import uuid

class Catalog(models.Model):
    class Status(models.TextChoices):
        UPLOADED = 'UPLOADED', 'Uploaded'
        PROCESSING = 'PROCESSING', 'Processing'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='catalogs', db_index=True)
    name = models.CharField(max_length=255)
    file_name = models.CharField(max_length=255)
    file_size = models.BigIntegerField(default=0)
    total_rows = models.IntegerField(default=0)
    total_products = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPLOADED, db_index=True)
    
    # Pre-classification health metrics
    summary_stats = models.JSONField(default=dict, blank=True)
    column_mapping = models.JSONField(default=dict, blank=True)
    
    # File storage path (optional if uploaded file saved locally)
    file_path = models.CharField(max_length=500, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'catalogs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.total_products} products)"
