"""
Celery asynchronous background classification tasks.
Features:
- Configurable chunk/batch sizes
- Failure isolation per product
- Idempotent resumable processing
- Real-time job progress updating
"""

import logging
from celery import shared_task
from django.utils import timezone
from apps.catalogs.models import Catalog
from apps.jobs.models import ProcessingJob
from services.pipeline_runner import PipelineRunner

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def process_catalog_classification_task(self, catalog_id: str, job_id: str, retry_failed_only: bool = False):
    try:
        catalog = Catalog.objects.get(id=catalog_id)
        job = ProcessingJob.objects.get(id=job_id)
    except Exception as e:
        logger.error(f"Failed to load catalog or job: {e}")
        return {'status': 'FAILED', 'error': str(e)}

    runner = PipelineRunner(catalog, job, batch_size=50)
    runner.run(retry_failed_only=retry_failed_only)

    return {
        'status': job.status,
        'processed': job.processed_items,
        'successful': job.successful_items,
        'failed': job.failed_items,
    }
