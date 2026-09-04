"""
Pipeline Runner for High-Volume Resumable Batch Catalogue Classification.
Executes batch classification with per-product and per-chunk exception isolation,
explicit Job & Chunk lifecycle tracking, progress persistence, and idempotency.
"""

import time
import logging
from typing import Optional
from django.utils import timezone
from django.db import transaction
from apps.catalogs.models import Catalog
from apps.products.models import Product
from apps.jobs.models import ProcessingJob, JobChunk
from services.classifier_service import ClassifierService
from services.semantic_embedding import SentenceEmbeddingEngine

logger = logging.getLogger(__name__)


class PipelineRunner:
    def __init__(self, catalog: Catalog, job: ProcessingJob, batch_size: int = 100):
        self.catalog = catalog
        self.job = job
        self.batch_size = batch_size
        self.classifier = ClassifierService()

    def run(self, retry_failed_only: bool = False):
        """
        Runs the batch classification pipeline.
        Resumable and idempotent: checks JobChunk states and product fingerprints.
        """
        logger.info(f"Starting pipeline runner for Catalog '{self.catalog.name}' (Job ID: {self.job.id})")

        self.job.status = ProcessingJob.JobStatus.RUNNING
        self.job.started_at = self.job.started_at or timezone.now()
        self.job.save(update_fields=['status', 'started_at'])

        self.catalog.status = Catalog.Status.PROCESSING
        self.catalog.save(update_fields=['status'])

        # Query products to process
        if retry_failed_only:
            target_qs = self.catalog.products.filter(
                processing_status__in=[Product.ProcessingStatus.FAILED, Product.ProcessingStatus.RETRYING]
            )
        else:
            target_qs = self.catalog.products.filter(
                processing_status__in=[Product.ProcessingStatus.PENDING, Product.ProcessingStatus.FAILED, Product.ProcessingStatus.RETRYING]
            )

        total_target = target_qs.count()
        self.job.total_items = total_target
        self.job.save(update_fields=['total_items'])

        if total_target == 0:
            logger.info("No pending products to classify.")
            self._finalize_job()
            return

        product_ids = list(target_qs.values_list('id', flat=True))
        num_chunks = (len(product_ids) + self.batch_size - 1) // self.batch_size

        self.job.total_chunks = num_chunks
        self.job.pending_chunks = num_chunks
        self.job.save(update_fields=['total_chunks', 'pending_chunks'])

        encoder = SentenceEmbeddingEngine.get_instance()

        processed_count = 0
        success_count = 0
        review_count = 0
        failed_count = 0

        for chunk_idx in range(num_chunks):
            start_i = chunk_idx * self.batch_size
            end_i = min(start_i + self.batch_size, len(product_ids))
            batch_ids = product_ids[start_i:end_i]

            # 1. Manage JobChunk Lifecycle
            chunk_obj, _ = JobChunk.objects.get_or_create(
                job=self.job,
                chunk_index=chunk_idx,
                defaults={
                    'start_index': start_i,
                    'end_index': end_i,
                    'total_items': len(batch_ids),
                    'status': JobChunk.ChunkStatus.PENDING
                }
            )

            # Skip DONE chunks during resume (Test 3 requirement!)
            if chunk_obj.status == JobChunk.ChunkStatus.DONE:
                logger.info(f"Chunk #{chunk_idx} already DONE. Skipping reprocessing.")
                processed_count += chunk_obj.processed_items
                continue

            chunk_obj.status = JobChunk.ChunkStatus.RUNNING
            chunk_obj.started_at = timezone.now()
            chunk_obj.save(update_fields=['status', 'started_at'])

            self.job.running_chunks = 1
            self.job.pending_chunks = max(0, self.job.pending_chunks - 1)
            self.job.save(update_fields=['running_chunks', 'pending_chunks'])

            # 2. Chunk-level exception isolation
            chunk_failed_prods = 0
            chunk_processed_prods = 0

            try:
                batch_prods = list(Product.objects.filter(id__in=batch_ids).prefetch_related('images'))

                # Pre-encode product query texts in a single fast PyTorch tensor batch call
                batch_texts = [
                    f"{p.title or ''} {p.product_type or ''} {p.brand or ''} {p.materials or ''} {p.color or ''} {(p.bullets or '')[:200]} {(p.description or '')[:300]}"
                    for p in batch_prods
                ]
                batch_vectors = encoder.batch_encode(batch_texts)

                # Separate skipped items (idempotency) and active items
                active_prods = []
                active_indices = []
                for idx, p_item in enumerate(batch_prods):
                    if p_item.is_skipped_reclassification:
                        logger.info(f"Product SKU '{p_item.product_number}' content unchanged. Skipping reclassification.")
                        processed_count += 1
                        chunk_processed_prods += 1
                    else:
                        active_prods.append(p_item)
                        active_indices.append(idx)

                if active_prods:
                    sub_vectors = batch_vectors[active_indices] if batch_vectors is not None and len(batch_vectors) == len(batch_prods) else None
                    batch_results = self.classifier.classify_batch(active_prods, precomputed_vectors=sub_vectors)

                    for item in batch_results:
                        if item['new_status'] in [Product.ProcessingStatus.AUTO_APPROVED, Product.ProcessingStatus.CLASSIFIED]:
                            success_count += 1
                        else:
                            review_count += 1
                        processed_count += 1
                        chunk_processed_prods += 1

                # Mark chunk as DONE
                chunk_obj.status = JobChunk.ChunkStatus.DONE
                chunk_obj.processed_items = chunk_processed_prods
                chunk_obj.failed_items = chunk_failed_prods
                chunk_obj.completed_at = timezone.now()
                chunk_obj.save(update_fields=['status', 'processed_items', 'failed_items', 'completed_at'])

                self.job.done_chunks += 1
                self.job.running_chunks = 0
                self.job.save(update_fields=['done_chunks', 'running_chunks'])

            except Exception as chunk_err:
                logger.exception(f"Chunk #{chunk_idx} processing failed: {str(chunk_err)}")
                chunk_obj.status = JobChunk.ChunkStatus.FAILED
                chunk_obj.error_message = str(chunk_err)
                chunk_obj.save(update_fields=['status', 'error_message'])

                self.job.failed_chunks += 1
                self.job.running_chunks = 0
                self.job.save(update_fields=['failed_chunks', 'running_chunks'])

            # Update job progress checkpoint after each chunk
            pct = round((processed_count / total_target) * 100.0, 2)
            self.job.processed_items = processed_count
            self.job.successful_items = success_count + review_count
            self.job.failed_items = failed_count
            self.job.classified_products = success_count
            self.job.needs_review_products = review_count
            self.job.progress_percentage = pct
            self.job.current_step = f"Processed {processed_count}/{total_target} products ({pct}%)"
            self.job.save(update_fields=[
                'processed_items', 'successful_items', 'failed_items',
                'classified_products', 'needs_review_products',
                'progress_percentage', 'current_step'
            ])

        self._finalize_job()

    def _finalize_job(self):
        total_prods = self.catalog.products.count()
        completed = self.catalog.products.filter(
            processing_status__in=[Product.ProcessingStatus.AUTO_APPROVED, Product.ProcessingStatus.CLASSIFIED]
        ).count()
        manual_review = self.catalog.products.filter(
            processing_status=Product.ProcessingStatus.REQUIRES_REVIEW
        ).count()
        failed = self.catalog.products.filter(processing_status=Product.ProcessingStatus.FAILED).count()

        if failed == total_prods and total_prods > 0:
            self.catalog.status = Catalog.Status.FAILED
            self.job.status = ProcessingJob.JobStatus.FAILED
        elif failed > 0:
            self.catalog.status = Catalog.Status.COMPLETED
            self.job.status = ProcessingJob.JobStatus.PARTIAL
        else:
            self.catalog.status = Catalog.Status.COMPLETED
            self.job.status = ProcessingJob.JobStatus.COMPLETED

        self.catalog.save(update_fields=['status'])

        self.job.done_chunks = JobChunk.objects.filter(job=self.job, status=JobChunk.ChunkStatus.DONE).count()
        self.job.failed_chunks = JobChunk.objects.filter(job=self.job, status=JobChunk.ChunkStatus.FAILED).count()
        self.job.classified_products = completed
        self.job.needs_review_products = manual_review
        self.job.failed_items = failed
        self.job.current_step = f"Completed: {completed} auto-approved, {manual_review} pending review, {failed} failed."
        self.job.completed_at = timezone.now()
        self.job.save(update_fields=['status', 'done_chunks', 'failed_chunks', 'classified_products', 'needs_review_products', 'failed_items', 'current_step', 'completed_at'])

        logger.info(f"Pipeline finished for Catalog '{self.catalog.name}': {completed} completed, {manual_review} review required, {failed} failed.")
