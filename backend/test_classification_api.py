import django, os, time
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.catalogs.models import Catalog
from apps.products.models import Product
from apps.classification.models import ClassificationResult
from apps.jobs.models import ProcessingJob
from services.import_service import ImportService
from rest_framework.test import APIRequestFactory
from apps.catalogs.views import CatalogViewSet

# 1. Clean check
Catalog.objects.all().delete()
assert Catalog.objects.count() == 0

# 2. Upload 100-sample catalog
fpath = r'C:\Users\josep\OneDrive\project\Product List.xlsx'
importer = ImportService('Product_List_100_Samples', fpath, 'Product_List_100_Samples.xlsx')
cat = importer.parse_and_create(batch_size=50, sample_limit=100)
cat.status = Catalog.Status.UPLOADED
cat.save()

total = cat.products.count()
pending = cat.products.filter(processing_status='PENDING').count()
classified = ClassificationResult.objects.filter(product__catalog=cat).count()
print(f'Import: total={total}, pending={pending}, classified={classified}')
assert total == 100
assert pending == 100
assert classified == 0

# 3. Trigger classification via API action endpoint
factory = APIRequestFactory()
view = CatalogViewSet.as_view({'post': 'start_classification'})
resp = view(factory.post(f'/api/catalogs/{cat.id}/start-classification/'), pk=str(cat.id))
print(f'Start classification API response status: {resp.status_code}, data: {resp.data}')
assert resp.status_code in [200, 202]

# 4. Wait for background thread to complete
t0 = time.time()
while time.time() - t0 < 60:
    time.sleep(2)
    cat.refresh_from_db()
    c_count = cat.products.filter(processing_status__in=['CLASSIFIED', 'COMPLETED', 'AUTO_APPROVED']).count()
    r_count = cat.products.filter(processing_status__in=['REQUIRES_REVIEW', 'MANUAL_REVIEW']).count()
    f_count = cat.products.filter(processing_status='FAILED').count()
    p_count = cat.products.filter(processing_status='PENDING').count()
    done = c_count + r_count + f_count
    print(f'Progress: done={done}/100 (pending={p_count}, review={r_count}, failed={f_count}, classified={c_count})')
    if done == 100:
        break

assert done == 100, f'Expected 100 completed, got {done}'
print(f'Classification completed in {round(time.time()-t0, 1)}s')

# 5. Clean up for user testing
Catalog.objects.all().delete()
print('Reset database to 0 catalogs.')
