from django.db import models


class TaxonomyVersion(models.Model):
    STATUS_IMPORTING = 'IMPORTING'
    STATUS_ACTIVE = 'ACTIVE'
    STATUS_ARCHIVED = 'ARCHIVED'
    STATUS_FAILED = 'FAILED'
    STATUS_CHOICES = [
        (STATUS_IMPORTING, 'Importing'),
        (STATUS_ACTIVE, 'Active'),
        (STATUS_ARCHIVED, 'Archived'),
        (STATUS_FAILED, 'Failed'),
    ]

    version_code = models.CharField(max_length=50, unique=True, db_index=True)  # e.g. "2026-08"
    release_tag = models.CharField(max_length=100, blank=True, default='')      # e.g. "v2026-08"
    release_name = models.CharField(max_length=200, blank=True, default='')
    release_status = models.CharField(max_length=50, default='STABLE')          # STABLE / UNSTABLE
    name = models.CharField(max_length=200, default='Shopify Standard Product Taxonomy')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_IMPORTING, db_index=True)
    is_active = models.BooleanField(default=False, db_index=True)

    source_urls = models.JSONField(default=dict, blank=True)
    asset_checksums = models.JSONField(default=dict, blank=True)
    stats = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, default='')

    imported_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'taxonomy_versions'
        ordering = ['-imported_at']

    def __str__(self):
        return f"{self.name} ({self.version_code} - {self.status})"


class TaxonomyCategory(models.Model):
    taxonomy_version = models.ForeignKey(TaxonomyVersion, on_delete=models.CASCADE, related_name='categories')
    external_id = models.CharField(max_length=150, db_index=True)  # e.g. "gid://shopify/TaxonomyCategory/ap-1"
    name = models.CharField(max_length=255, db_index=True)
    full_path = models.CharField(max_length=1000, db_index=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children_categories')
    level = models.IntegerField(default=0)
    is_leaf = models.BooleanField(default=True, db_index=True)
    is_root = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)

    # Fast hierarchical cache
    ancestor_ids = models.JSONField(default=list, blank=True)
    children_ids = models.JSONField(default=list, blank=True)

    # Store directly assigned attributes (IDs list for fast lookups)
    attribute_ids = models.JSONField(default=list, blank=True)
    raw_data = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'taxonomy_categories'
        ordering = ['full_path']
        unique_together = ('taxonomy_version', 'external_id')
        indexes = [
            models.Index(fields=['taxonomy_version', 'is_leaf']),
            models.Index(fields=['name']),
            models.Index(fields=['full_path']),
        ]

    def __str__(self):
        return self.full_path


class TaxonomyAttribute(models.Model):
    taxonomy_version = models.ForeignKey(TaxonomyVersion, on_delete=models.CASCADE, related_name='attributes')
    external_id = models.CharField(max_length=150, db_index=True)  # e.g. "gid://shopify/TaxonomyAttribute/5398"
    name = models.CharField(max_length=255, db_index=True)
    handle = models.CharField(max_length=255, blank=True, default='')
    description = models.TextField(blank=True, default='')
    data_type = models.CharField(max_length=50, default='choice')  # choice, string, number, boolean
    raw_data = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'taxonomy_attributes'
        ordering = ['name']
        unique_together = ('taxonomy_version', 'external_id')
        indexes = [
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return f"{self.name} ({self.external_id})"


class TaxonomyAttributeValue(models.Model):
    attribute = models.ForeignKey(TaxonomyAttribute, on_delete=models.CASCADE, related_name='values')
    external_id = models.CharField(max_length=150, blank=True, default='')  # e.g. "gid://shopify/TaxonomyValue/123"
    name = models.CharField(max_length=255, db_index=True)
    handle = models.CharField(max_length=255, blank=True, default='')
    normalized_name = models.CharField(max_length=255, db_index=True)
    raw_data = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'taxonomy_attribute_values'
        ordering = ['name']
        indexes = [
            models.Index(fields=['attribute', 'normalized_name']),
        ]

    def __str__(self):
        return f"{self.name} ({self.attribute.name})"


class CategoryAttribute(models.Model):
    category = models.ForeignKey(TaxonomyCategory, on_delete=models.CASCADE, related_name='category_attributes')
    attribute = models.ForeignKey(TaxonomyAttribute, on_delete=models.CASCADE, related_name='attribute_categories')
    is_required = models.BooleanField(default=False)
    is_extended = models.BooleanField(default=False)
    raw_data = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'category_attributes'
        unique_together = ('category', 'attribute')

    def __str__(self):
        return f"{self.category.name} -> {self.attribute.name}"
