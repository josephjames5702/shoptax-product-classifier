import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.catalogs.models import Catalog
from apps.products.models import Product
from apps.classification.models import ClassificationResult
from django.db.models import Count

c = Catalog.objects.get(id='9af0c5a6-d06c-40c3-bcd4-73692684dce0')
prods = Product.objects.filter(catalog=c)
completed = prods.filter(processing_status='COMPLETED').count()
review = prods.filter(processing_status='MANUAL_REVIEW').count()
failed = prods.filter(processing_status='FAILED').count()
pending = prods.filter(processing_status='PENDING').count()

grouped = (
    ClassificationResult.objects.filter(product__catalog=c)
    .values('category__id', 'category__external_id', 'category__name', 'category__full_path')
    .annotate(p_count=Count('id'))
    .order_by('-p_count')
)

print('=== FINAL AUDIT OF 4,999 PRODUCT CATALOGUE ===')
print('Catalog Name:', c.name)
print('Total Products in DB:', prods.count())
print('Completed (Approved):', completed)
print('Manual Review Queue:', review)
print('Failed:', failed)
print('Pending:', pending)
print('Total Classified:', completed + review)
print('Unique Canonical Shopify Categories:', len(grouped))
print('\nTop 10 Shopify Categories by Product Count:')
for idx, g in enumerate(grouped[:10], start=1):
    path = g['category__full_path']
    gid = g['category__external_id']
    cnt = g['p_count']
    print(f'  {idx}. {path} ({gid}) -> {cnt} products')
