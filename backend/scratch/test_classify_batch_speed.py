import os
import sys
import time
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.catalogs.models import Catalog
from apps.products.models import Product
from services.classifier_service import ClassifierService
from services.semantic_embedding import SentenceEmbeddingEngine

cat = Catalog.objects.first()
prods = list(cat.products.all()[:100])
print(f"Loaded {len(prods)} products from catalog {cat.name}")

encoder = SentenceEmbeddingEngine.get_instance()
classifier = ClassifierService()

t0 = time.time()
texts = [
    f"{p.title or ''} {p.product_type or ''} {p.brand or ''} {p.materials or ''} {p.color or ''} {(p.bullets or '')[:200]} {(p.description or '')[:300]}"
    for p in prods
]
vecs = encoder.batch_encode(texts)
t_vec = time.time() - t0
print(f"Batch embedding took: {t_vec:.4f}s")

t0 = time.time()
results = classifier.classify_batch(prods, precomputed_vectors=vecs)
t_batch = time.time() - t0
print(f"classify_batch 100 products (including atomic bulk DB write) took: {t_batch:.4f}s ({t_batch/100:.4f}s/product, {60/(t_batch/100):.1f} prods/min)")
