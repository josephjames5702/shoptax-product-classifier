import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.catalogs.models import Catalog
from apps.products.models import Product
from services.import_service import ImportService

# Reset
Catalog.objects.all().delete()
print('Catalogs before upload:', Catalog.objects.count())

# Upload
fpath = r'C:\Users\josep\OneDrive\project\Product List.xlsx'
importer = ImportService('Product_List_100_Samples', fpath, 'Product_List_100_Samples.xlsx')
cat = importer.parse_and_create(batch_size=50, sample_limit=100)
cat.status = Catalog.Status.UPLOADED
cat.save()

total = cat.products.count()
pending = cat.products.filter(processing_status='PENDING').count()
print(f'Catalog: {cat.name} (id={cat.id})')
print(f'Total products: {total}')
print(f'Pending products: {pending}')
assert total == 100, f'Expected 100, got {total}'
assert pending == 100, f'Expected 100 pending, got {pending}'
print('TEST PASSED: Fresh 100-sample upload is 100% PENDING with 0 classified.')
