import os
import sys
import time
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.catalogs.models import Catalog
from apps.products.models import Product
from apps.jobs.models import ProcessingJob
from services.classifier_service import ClassifierService
from services.retrieval_service import RetrievalService
from services.semantic_embedding import SentenceEmbeddingEngine

print("Django setup complete.")

total_products = Product.objects.count()
print(f"Total products in DB: {total_products}")

catalog = Catalog.objects.first()
if not catalog:
    print("No catalog found!")
    sys.exit(0)

print(f"Using catalog: {catalog.name} (id: {catalog.id})")
products = list(catalog.products.all()[:20])
print(f"Testing on {len(products)} products...")

retrieval = RetrievalService.get_instance()
encoder = SentenceEmbeddingEngine.get_instance()
classifier = ClassifierService()

# 1. Measure batch embedding
t0 = time.time()
texts = [
    f"{p.title or ''} {p.product_type or ''} {p.brand or ''} {p.materials or ''} {p.color or ''} {(p.bullets or '')[:200]} {(p.description or '')[:300]}"
    for p in products
]
batch_vectors = encoder.batch_encode(texts)
t_embed = time.time() - t0
print(f"Batch embedding {len(texts)} texts took: {t_embed:.4f}s ({t_embed/len(texts):.4f}s per product)")

# 2. Measure single product classification breakdown
p = products[0]
p_vec = batch_vectors[0]

p_data = {
    'product_number': p.product_number or '',
    'title': p.title or '',
    'description': p.description or '',
    'bullets': p.bullets or '',
    'brand': p.brand or '',
    'product_type': p.product_type or '',
    'materials': p.materials or '',
    'color': p.color or '',
    'dimensions': p.dimensions or '',
}

t0 = time.time()
cands = retrieval.retrieve_candidates(p_data, top_k_final=10, product_vector=p_vec)
t_retrieve = time.time() - t0
print(f"retrieve_candidates took: {t_retrieve:.4f}s")

t0 = time.time()
res = classifier.classify_product(p, precomputed_vector=p_vec)
t_full = time.time() - t0
print(f"classify_product full execution took: {t_full:.4f}s")

# Measure full 20 products loop
t0 = time.time()
for idx, prod in enumerate(products):
    classifier.classify_product(prod, precomputed_vector=batch_vectors[idx])
t_20 = time.time() - t0
print(f"20 products classified in: {t_20:.4f}s ({t_20/20:.4f}s per product, {60/(t_20/20):.1f} products/min)")
