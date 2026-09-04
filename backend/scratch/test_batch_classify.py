import os
import sys
import time
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.catalogs.models import Catalog
from apps.products.models import Product
from apps.classification.models import ClassificationResult, ClassificationAlternative, ExtractedAttribute
from services.retrieval_service import RetrievalService
from services.classifier_service import ClassifierService
from services.semantic_embedding import SentenceEmbeddingEngine

cat = Catalog.objects.first()
prods = list(cat.products.all()[:100])
print(f"Loaded {len(prods)} products from catalog {cat.name}")

retrieval = RetrievalService.get_instance()
from apps.taxonomy.models import TaxonomyVersion
active_version = TaxonomyVersion.objects.filter(is_active=True).first()
retrieval._ensure_taxonomy_index(active_version)

t0 = time.time()
encoder = SentenceEmbeddingEngine.get_instance()
classifier = ClassifierService()

texts = [
    f"{p.title or ''} {p.product_type or ''} {p.brand or ''} {p.materials or ''} {p.color or ''} {(p.bullets or '')[:200]} {(p.description or '')[:300]}"
    for p in prods
]
vecs = encoder.batch_encode(texts)
t_embed = time.time() - t0
print(f"Batch embedding 100 took: {t_embed:.4f}s")

t0 = time.time()
for idx, p in enumerate(prods):
    res = classifier.classify_product(p, precomputed_vector=vecs[idx])
t_class = time.time() - t0
print(f"100 products classified & saved: {t_class:.4f}s ({t_class/100:.4f}s/product, {60/(t_class/100):.1f} prods/min)")
