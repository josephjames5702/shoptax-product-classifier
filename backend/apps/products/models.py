from django.db import models
import uuid

class Product(models.Model):
    class ProcessingStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PROCESSING = 'PROCESSING', 'Processing'
        CLASSIFIED = 'CLASSIFIED', 'Classified'
        AUTO_APPROVED = 'AUTO_APPROVED', 'Auto Approved'
        REQUIRES_REVIEW = 'REQUIRES_REVIEW', 'Requires Review'
        FAILED = 'FAILED', 'Failed'
        RETRYING = 'RETRYING', 'Retrying'
        COMPLETED = 'COMPLETED', 'Completed'
        MANUAL_REVIEW = 'MANUAL_REVIEW', 'Manual Review'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    catalog = models.ForeignKey('catalogs.Catalog', on_delete=models.CASCADE, related_name='products')
    
    # Core identifiers & normalized attributes
    product_number = models.CharField(max_length=150, blank=True, null=True, db_index=True) # SKU
    model_number = models.CharField(max_length=150, blank=True, null=True)
    title = models.CharField(max_length=500, db_index=True)
    description = models.TextField(blank=True, default='')
    bullets = models.TextField(blank=True, default='')
    brand = models.CharField(max_length=200, blank=True, default='', db_index=True)
    product_type = models.CharField(max_length=200, blank=True, default='', db_index=True)
    materials = models.CharField(max_length=500, blank=True, default='')
    color = models.CharField(max_length=200, blank=True, default='')
    color_collection = models.CharField(max_length=200, blank=True, default='')
    dimensions = models.CharField(max_length=500, blank=True, default='')
    set_includes = models.TextField(blank=True, default='')
    
    # Financial / Logistics fields (reference only)
    item_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    map_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    msrp = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    country_of_origin = models.CharField(max_length=100, blank=True, default='')
    shipping_method = models.CharField(max_length=150, blank=True, default='')
    product_url = models.URLField(max_length=1000, blank=True, default='')
    
    # Critical: Raw data preserves unmapped columns and evaluation categories
    raw_data = models.JSONField(default=dict, blank=True)
    
    # Fingerprinting & Idempotency
    source_fingerprint = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    is_skipped_reclassification = models.BooleanField(default=False)
    skip_reason = models.CharField(max_length=255, blank=True, default='')

    class DecisionStatus(models.TextChoices):
        NOT_REVIEWED = 'NOT_REVIEWED', 'Not Reviewed'
        AUTO_CLASSIFIED = 'AUTO_CLASSIFIED', 'Auto Classified'
        ADMIN_APPROVED = 'ADMIN_APPROVED', 'Admin Approved'
        ADMIN_DECLINED = 'ADMIN_DECLINED', 'Admin Declined'
        REQUIRES_REVIEW = 'REQUIRES_REVIEW', 'Requires Review'

    # State & Execution tracking
    processing_status = models.CharField(
        max_length=20, 
        choices=ProcessingStatus.choices, 
        default=ProcessingStatus.PENDING,
        db_index=True
    )

    # Admin decision status (separate from classification processing status)
    decision_status = models.CharField(
        max_length=20,
        choices=DecisionStatus.choices,
        default=DecisionStatus.NOT_REVIEWED,
        db_index=True
    )
    reviewed_by = models.CharField(max_length=150, blank=True, null=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    decline_reason = models.TextField(blank=True, default='')

    attempts = models.IntegerField(default=0)
    last_error = models.TextField(blank=True, null=True)
    last_processed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['catalog', 'processing_status']),
            models.Index(fields=['product_number']),
            models.Index(fields=['source_fingerprint']),
            models.Index(fields=['brand']),
        ]

    def __str__(self):
        return f"{self.product_number or 'NO-SKU'} - {self.title[:50]}"


class ProductImage(models.Model):
    class ImageStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        DOWNLOADED = 'DOWNLOADED', 'Downloaded'
        FAILED = 'FAILED', 'Failed'
        INVALID = 'INVALID', 'Invalid'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    url = models.URLField(max_length=1000)
    position = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=ImageStatus.choices, default=ImageStatus.PENDING, db_index=True)
    error_message = models.TextField(blank=True, null=True)
    image_hash = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    local_path = models.CharField(max_length=500, blank=True, null=True)
    width = models.IntegerField(null=True, blank=True)
    height = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'product_images'
        ordering = ['product', 'position']
        indexes = [
            models.Index(fields=['product', 'position']),
            models.Index(fields=['image_hash']),
        ]

    def __str__(self):
        return f"Image #{self.position} for {self.product.product_number or self.product.id}"
