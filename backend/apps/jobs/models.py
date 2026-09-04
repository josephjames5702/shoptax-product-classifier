from django.db import models
import uuid

class ProcessingJob(models.Model):
    class JobType(models.TextChoices):
        CLASSIFICATION = 'CLASSIFICATION', 'Full Classification'
        RETRY_FAILED = 'RETRY_FAILED', 'Retry Failed Products'
        IMAGE_DOWNLOAD = 'IMAGE_DOWNLOAD', 'Image Fetch & Cache'

    class JobStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        RUNNING = 'RUNNING', 'Running'
        COMPLETED = 'COMPLETED', 'Completed'
        PARTIAL = 'PARTIAL', 'Partially Completed'
        FAILED = 'FAILED', 'Failed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    catalog = models.ForeignKey('catalogs.Catalog', on_delete=models.CASCADE, related_name='processing_jobs')
    job_type = models.CharField(max_length=30, choices=JobType.choices, default=JobType.CLASSIFICATION)
    status = models.CharField(max_length=20, choices=JobStatus.choices, default=JobStatus.PENDING, db_index=True)
    
    total_items = models.IntegerField(default=0)
    processed_items = models.IntegerField(default=0)
    successful_items = models.IntegerField(default=0)
    failed_items = models.IntegerField(default=0)
    classified_products = models.IntegerField(default=0)
    needs_review_products = models.IntegerField(default=0)
    
    total_chunks = models.IntegerField(default=0)
    done_chunks = models.IntegerField(default=0)
    failed_chunks = models.IntegerField(default=0)
    pending_chunks = models.IntegerField(default=0)
    running_chunks = models.IntegerField(default=0)

    progress_percentage = models.FloatField(default=0.0)
    current_step = models.CharField(max_length=255, default='Initialized')
    
    error_log = models.JSONField(default=list, blank=True)
    celery_task_id = models.CharField(max_length=255, blank=True, null=True)
    
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'processing_jobs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.job_type} on {self.catalog.name} [{self.status}: {self.progress_percentage:.1f}%]"

    @property
    def duration_seconds(self):
        if not self.started_at:
            return 0.0
        end_t = self.completed_at or models.functions.Now()
        return round((end_t - self.started_at).total_seconds(), 2) if self.completed_at else 0.0


class JobChunk(models.Model):
    class ChunkStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        RUNNING = 'RUNNING', 'Running'
        DONE = 'DONE', 'Done'
        FAILED = 'FAILED', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(ProcessingJob, on_delete=models.CASCADE, related_name='chunks')
    chunk_index = models.IntegerField()
    start_index = models.IntegerField(default=0)
    end_index = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=ChunkStatus.choices, default=ChunkStatus.PENDING, db_index=True)
    
    total_items = models.IntegerField(default=0)
    processed_items = models.IntegerField(default=0)
    failed_items = models.IntegerField(default=0)
    
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'job_chunks'
        ordering = ['chunk_index']

    def __str__(self):
        return f"Chunk #{self.chunk_index} for Job {self.job_id} [{self.status}]"
