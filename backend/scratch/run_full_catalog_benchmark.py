import os
import sys
import time
import json
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.catalogs.models import Catalog
from apps.products.models import Product
from apps.jobs.models import ProcessingJob
from apps.classification.models import ClassificationResult
from services.pipeline_runner import PipelineRunner
from django.db.models import Count

catalog = Catalog.objects.get(id="4aaee261-b8ac-46a4-8f5c-665b46ff1d15")
print(f"Starting benchmark for Catalog: '{catalog.name}' (Total DB products: {catalog.total_products})")

# Ensure a processing job exists
job = ProcessingJob.objects.filter(catalog=catalog, status__in=[ProcessingJob.JobStatus.PENDING, ProcessingJob.JobStatus.RUNNING]).first()
if not job:
    job = ProcessingJob.objects.create(
        catalog=catalog,
        job_type=ProcessingJob.JobType.CLASSIFICATION,
        status=ProcessingJob.JobStatus.PENDING,
        total_items=catalog.total_products,
        current_step="Queued for high-speed benchmark",
    )

runner = PipelineRunner(catalog, job, batch_size=100)

t_start = time.time()
print(f"Beginning pipeline execution with batch_size=100...")
runner.run(retry_failed_only=False)
t_end = time.time()

elapsed_sec = t_end - t_start
products_per_min = (catalog.total_products / elapsed_sec) * 60 if elapsed_sec > 0 else 0

# Verification & Metrics
prods = Product.objects.filter(catalog=catalog)
completed_count = prods.filter(processing_status=Product.ProcessingStatus.AUTO_APPROVED).count()
review_count = prods.filter(processing_status__in=[Product.ProcessingStatus.CLASSIFIED, Product.ProcessingStatus.REQUIRES_REVIEW]).count()
failed_count = prods.filter(processing_status=Product.ProcessingStatus.FAILED).count()
pending_count = prods.filter(processing_status=Product.ProcessingStatus.PENDING).count()

# Grouping verification by canonical Shopify category GID
grouped = (
    ClassificationResult.objects.filter(product__catalog=catalog)
    .values('category__id', 'category__external_id', 'category__name', 'category__full_path')
    .annotate(p_count=Count('id'))
    .order_by('-p_count')
)

unique_categories_count = len(grouped)

print("\n" + "="*60)
print("REAL 5,000-PRODUCT BENCHMARK REPORT")
print("="*60)
print(f"1. Total Products in Catalog: {catalog.total_products}")
print(f"2. Total Time: {elapsed_sec:.2f} seconds ({elapsed_sec/60:.2f} minutes)")
print(f"3. Processing Speed: {products_per_min:.1f} products/minute")
print(f"4. Completed (High Confidence): {completed_count}")
print(f"5. Manual Review Queue: {review_count}")
print(f"6. Failed Products: {failed_count}")
print(f"7. Pending Products: {pending_count}")
print(f"8. Unique Canonical Shopify Categories: {unique_categories_count}")
print(f"9. Individual Product Records Preserved (No Merging): {prods.count() == catalog.total_products}")
print(f"10. Top 5 Grouped Categories by Canonical GID:")
for idx, g in enumerate(grouped[:5], start=1):
    print(f"    {idx}. {g['category__full_path']} ({g['category__external_id']}): {g['p_count']} products")
print("="*60)
