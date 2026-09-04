import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.catalogs.models import Catalog
from apps.products.models import Product
from apps.classification.models import ClassificationResult
from services.import_service import ImportService
from services.pipeline_runner import PipelineRunner
from apps.jobs.models import ProcessingJob

print("=" * 60)
print("MULTIPLE CATALOG INDEPENDENCE TEST SUITE")
print("=" * 60)

# Step 1: Clean database of test catalogs (preserve taxonomy)
Catalog.objects.all().delete()
assert Catalog.objects.count() == 0, "Failed to start with 0 catalogs"
assert Product.objects.count() == 0, "Failed to start with 0 products"
print("Step 1: Database successfully cleaned. 0 Catalogs, 0 Products.")

# Step 2: Upload Catalogue A (using the real 4,999-product file)
file_a = r"C:\Users\josep\OneDrive\project 2\V5\Product List.xlsx"
if not os.path.exists(file_a):
    file_a = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "media", "uploads", "Product List_Product List.xlsx")

importer_a = ImportService(catalog_name="Catalogue A", file_path=file_a, original_filename="Product List.xlsx")
cat_a = importer_a.parse_and_create(batch_size=500)

# Step 3: Verify Catalogue A
assert Catalog.objects.count() == 1, f"Expected 1 catalog, got {Catalog.objects.count()}"
prods_a = Product.objects.filter(catalog=cat_a)
assert prods_a.count() == 4999, f"Expected 4999 products in A, got {prods_a.count()}"
assert prods_a.filter(processing_status=Product.ProcessingStatus.PENDING).count() == 4999, "All products in A should be PENDING"
print(f"Step 2 & 3: Uploaded Catalogue A. ID: {cat_a.id}, Total Products: {prods_a.count()}.")

# Step 4 & 5: Simulate refresh / new query
cat_a_refreshed = Catalog.objects.get(id=cat_a.id)
assert cat_a_refreshed.products.count() == 4999, "Refresh failed to preserve Catalogue A products"
print("Step 4 & 5: Refresh simulated. Catalogue A and all 4999 products intact.")

# Step 6 & 7: Upload a second, different Catalogue B
# We create a sample Catalogue B CSV with 20 distinct products
temp_b_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalogue_b_test.csv")
with open(temp_b_path, "w", encoding="utf-8") as f:
    f.write("Product Number,Product Name,Brand,Category,Description\n")
    for i in range(1, 21):
        f.write(f"CAT-B-SKU-{i:03d},Office Chair Model B-{i},ErgoCorp,Office Furniture,High back ergonomic office desk chair\n")

importer_b = ImportService(catalog_name="Catalogue B", file_path=temp_b_path, original_filename="catalogue_b_test.csv")
cat_b = importer_b.parse_and_create(batch_size=50)

# Verify Step 7:
assert Catalog.objects.count() == 2, f"Expected 2 catalogs, got {Catalog.objects.count()}"
assert Catalog.objects.filter(id=cat_a.id).exists(), "Catalogue A disappeared!"
assert Catalog.objects.filter(id=cat_b.id).exists(), "Catalogue B was not created!"
prods_a_after = Product.objects.filter(catalog=cat_a)
prods_b = Product.objects.filter(catalog=cat_b)
assert prods_a_after.count() == 4999, f"Catalogue A products changed! Got {prods_a_after.count()}"
assert prods_b.count() == 20, f"Catalogue B should have 20 products, got {prods_b.count()}"
print("Step 6 & 7: Uploaded Catalogue B. 2 independent catalogs exist. A has 4999, B has 20.")

# Step 8 & 9: Verify both persist after refresh
catalogs_all = list(Catalog.objects.all().order_by('created_at'))
assert len(catalogs_all) == 2, "Both catalogs must remain in database"
print("Step 8 & 9: Both Catalogue A and Catalogue B persist across queries.")

# Step 10 & 11: Verify query isolation
a_only = list(Product.objects.filter(catalog=cat_a).values_list('product_number', flat=True)[:5])
b_only = list(Product.objects.filter(catalog=cat_b).values_list('product_number', flat=True))
assert all(sku.startswith("EEI-") or sku.startswith("MOD-") or not sku.startswith("CAT-B-") for sku in a_only)
assert all(sku.startswith("CAT-B-") for sku in b_only)
print(f"Step 10 & 11: Products strictly isolated. B sample SKUs: {b_only[:3]}")

# Step 12 & 13: Start classification for Catalogue B ONLY
job_b = ProcessingJob.objects.create(catalog=cat_b, total_items=20, status=ProcessingJob.JobStatus.PENDING)
runner_b = PipelineRunner(cat_b, job_b, batch_size=10)
runner_b.run(retry_failed_only=False)

# Step 13 & 14: Verification of targeted classification
prods_b_classified = Product.objects.filter(catalog=cat_b, processing_status__in=[Product.ProcessingStatus.COMPLETED, Product.ProcessingStatus.MANUAL_REVIEW])
assert prods_b_classified.count() == 20, f"Expected 20 classified in B, got {prods_b_classified.count()}"

# Verify Catalogue A was UNTOUCHED:
prods_a_unclassified = Product.objects.filter(catalog=cat_a, processing_status=Product.ProcessingStatus.PENDING)
assert prods_a_unclassified.count() == 4999, f"Catalogue A was contaminated! Pending count is {prods_a_unclassified.count()}"

# Verify ClassificationResult records belong ONLY to Catalogue B products
cr_count_b = ClassificationResult.objects.filter(product__catalog=cat_b).count()
cr_count_a = ClassificationResult.objects.filter(product__catalog=cat_a).count()
assert cr_count_b == 20, f"Catalogue B should have 20 classification results, got {cr_count_b}"
assert cr_count_a == 0, f"Catalogue A should have 0 classification results, got {cr_count_a}"

print(f"Step 12, 13 & 14: Classification run on Catalogue B complete.")
print(f"  - Catalogue B products classified: {cr_count_b}/20")
print(f"  - Catalogue A products modified: 0 (All {prods_a_unclassified.count()} remain in initial PENDING state)")
print("=" * 60)
print("VERDICT: ALL 14 SCENARIO STEPS PASSED WITH 100% ISOLATION.")
print("=" * 60)
