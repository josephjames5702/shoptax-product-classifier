from rest_framework import serializers
from .models import ProcessingJob, JobChunk

class JobChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobChunk
        fields = [
            'id', 'chunk_index', 'start_index', 'end_index', 'status',
            'total_items', 'processed_items', 'failed_items',
            'started_at', 'completed_at', 'error_message'
        ]

class ProcessingJobSerializer(serializers.ModelSerializer):
    catalog_name = serializers.CharField(source='catalog.name', read_only=True)
    duration = serializers.FloatField(source='duration_seconds', read_only=True)
    chunks = JobChunkSerializer(many=True, read_only=True)

    class Meta:
        model = ProcessingJob
        fields = [
            'id', 'catalog_id', 'catalog_name', 'job_type', 'status',
            'total_items', 'processed_items', 'successful_items', 'failed_items',
            'classified_products', 'needs_review_products',
            'total_chunks', 'done_chunks', 'failed_chunks', 'pending_chunks', 'running_chunks',
            'progress_percentage', 'current_step', 'error_log', 'celery_task_id',
            'duration', 'started_at', 'completed_at', 'created_at', 'updated_at',
            'chunks'
        ]
