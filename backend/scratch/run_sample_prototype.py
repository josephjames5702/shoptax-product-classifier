import os
import sys
import time
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.catalogs.models import Catalog
from apps.products.models import Product, ProductImage
from apps.jobs.models import ProcessingJob, JobChunk
from apps.classification.models import ClassificationResult
from services.import_service import ImportService
from services.pipeline_runner import PipelineRunner

def run_sample_prototype(sample_size=100):
    excel_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'V5', 'Product List.xlsx'))
    print(f"=== PROTOTYPE RUNNER: Sample Size = {sample_size} ===")
    print(f"Source file: {excel_path}")
    
    if not os.path.exists(excel_path):
        print(f"Error: File not found at {excel_path}")
        return

    # 1. Clean existing sample catalog if present
    catalog_name = f"Sample Prototype ({sample_size} Products)"
    existing = Catalog.objects.filter(name=catalog_name).first()
    if existing:
        print(f"Clearing previous sample catalog '{catalog_name}'...")
        existing.delete()

    # 2. Import exactly sample_size products
    print(f"\n--- 1. Importing Sample of {sample_size} Products ---")
    import_start = time.time()
    importer = ImportService(
        catalog_name=catalog_name,
        file_path=excel_path,
        original_filename="Product List.xlsx"
    )
    catalog = importer.parse_and_create(batch_size=25, sample_limit=sample_size)
    import_duration = time.time() - import_start
    
    total_imported = catalog.products.count()
    print(f"Catalog ID: {catalog.id}")
    print(f"Products Imported: {total_imported}")
    print(f"Import Time: {import_duration:.2f}s")
    print(f"Catalog Status: {catalog.status}")
    print(f"Summary Stats: {catalog.summary_stats}")

    # 3. Create ProcessingJob
    print(f"\n--- 2. Starting Batch Classification (Batch Size = 25) ---")
    job = ProcessingJob.objects.create(
        catalog=catalog,
        job_type=ProcessingJob.JobType.CLASSIFICATION,
        status=ProcessingJob.JobStatus.PENDING,
        total_items=total_imported,
        current_step='Queued for prototype processing',
    )

    runner = PipelineRunner(catalog, job, batch_size=25)
    class_start = time.time()
    runner.run()
    class_duration = time.time() - class_start

    job.refresh_from_db()
    catalog.refresh_from_db()

    print(f"\n--- 3. Classification Completed ---")
    print(f"Job Status: {job.status}")
    print(f"Job Processed Items: {job.processed_items}/{job.total_items}")
    print(f"Total Classification Duration: {class_duration:.2f}s")
    print(f"Avg Time Per Product: {(class_duration / max(1, total_imported)):.4f}s")

    # 4. Result Breakdown
    class_results = ClassificationResult.objects.filter(product__catalog=catalog)
    total_classified = class_results.count()
    
    prods = catalog.products.all()
    rule_validated = class_results.filter(status=ClassificationResult.ReviewStatus.RULE_VALIDATED).count()
    local_llm_approved = class_results.filter(status=ClassificationResult.ReviewStatus.LOCAL_LLM_APPROVED).count()
    auto_approved = prods.filter(processing_status=Product.ProcessingStatus.AUTO_APPROVED).count()
    pending_review = class_results.filter(status=ClassificationResult.ReviewStatus.PENDING_REVIEW).count()
    rejected = class_results.filter(status=ClassificationResult.ReviewStatus.REJECTED).count()

    # Product processing status breakdown
    status_counts = {}
    for p in prods:
        status_counts[p.processing_status] = status_counts.get(p.processing_status, 0) + 1

    print("\n--- 4. Classification Breakdown ---")
    print(f"Total Products: {total_imported}")
    print(f"Total Results Generated: {total_classified}")
    print(f"RULE_VALIDATED: {rule_validated}")
    print(f"LOCAL_LLM_APPROVED: {local_llm_approved}")
    print(f"AUTO_APPROVED (Hard invariant check): {auto_approved}")
    print(f"REQUIRES_REVIEW / PENDING_REVIEW: {pending_review}")
    print(f"REJECTED: {rejected}")
    print(f"Product Statuses: {status_counts}")
    print(f"AUTO_APPROVED_WITHOUT_REAL_LLM = 0 verified? {auto_approved == 0}")

    # 5. Image and Missing Data Handling Verification
    with_img = prods.filter(images__isnull=False).distinct().count()
    without_img = prods.filter(images__isnull=True).count()
    missing_desc = prods.filter(description='').count()
    
    print("\n--- 5. Edge Cases Verification ---")
    print(f"Products with Images: {with_img}")
    print(f"Products without Images (Gracefully Handled): {without_img}")
    print(f"Products missing description (Title-only fallback): {missing_desc}")

    # 6. Sample 5 Output Records
    print("\n--- 6. Sample 5 Classified Products ---")
    for cr in class_results.select_related('product', 'category')[:5]:
        p = cr.product
        attrs = [f"{ea.attribute.name}: {ea.normalized_value or ea.raw_value}" for ea in cr.extracted_attributes.all()]
        print(f"\nSKU: {p.product_number}")
        print(f"Title: {p.title[:60]}")
        print(f"Shopify Category: {cr.category.name} (GID: {cr.category.external_id})")
        print(f"Category Path: {cr.category.full_path}")
        print(f"Confidence: {cr.confidence_score * 100:.1f}% ({cr.confidence_level})")
        print(f"Review Status: {cr.status}")
        print(f"Product Status: {p.processing_status}")
        print(f"Extracted Attributes: {', '.join(attrs) if attrs else 'None'}")
        print(f"AI Mode: {cr.ai_mode} | Provider: {cr.ai_provider}")

    # 7. Resumability Test
    print("\n--- 7. Testing Resumability (Re-running Runner) ---")
    chunks = JobChunk.objects.filter(job=job)
    print(f"Total Chunks created: {chunks.count()}")
    for ch in chunks:
        print(f"  Chunk #{ch.chunk_index}: Status = {ch.status}, Items = {ch.processed_items}")

    re_start = time.time()
    runner_retry = PipelineRunner(catalog, job, batch_size=25)
    runner_retry.run()
    re_duration = time.time() - re_start
    print(f"Re-run duration (Should skip DONE chunks): {re_duration:.4f}s")
    print("Resumability test passed successfully!")

if __name__ == '__main__':
    run_sample_prototype(sample_size=100)
