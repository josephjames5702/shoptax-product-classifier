import os
import sys
import time
import django
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.products.models import Product
from apps.taxonomy.models import TaxonomyVersion, TaxonomyCategory
from services.retrieval_service import RetrievalService, tokenize
from services.semantic_embedding import SentenceEmbeddingEngine

retrieval = RetrievalService.get_instance()
active_version = TaxonomyVersion.objects.filter(is_active=True).first()
retrieval._ensure_taxonomy_index(active_version)

product = Product.objects.first()
query_text = f"{product.title} {product.product_type} {product.brand} {product.materials} {product.color}"
query_tokens = tokenize(query_text)
query_set = set(query_tokens)

print(f"Query text: {query_text}")
print(f"Query tokens: {query_tokens}")

encoder = SentenceEmbeddingEngine.get_instance()
p_vec = encoder.encode_text(query_text)

# Test 1: Inverted index lookup
t0 = time.time()
candidate_indices = set()
for t in query_set:
    if t in retrieval._inverted_token_index:
        candidate_indices.update(retrieval._inverted_token_index[t])
t_idx = time.time() - t0
print(f"Index lookup: {len(candidate_indices)} candidates in {t_idx:.6f}s")

# Test 2: BM25 loop
k1 = 1.5
b = 0.75
avg_dl = retrieval._avg_dl or 20.0
title_lower = product.title.lower() if product.title else ""

t0 = time.time()
bm25_scores = []
for idx in candidate_indices:
    d = retrieval._category_docs[idx]
    matching_tokens = query_set & d['token_set']

    score = 0.0
    doc_len = len(d['tokens'])
    term_counts = d['term_counts']

    for t in matching_tokens:
        tf = term_counts[t]
        idf_val = retrieval._bm25_idf.get(t, 1.0)
        denom = tf + k1 * (1 - b + b * (doc_len / avg_dl))
        score += idf_val * ((tf * (k1 + 1)) / denom)

    if d['name'].lower() in title_lower:
        score += 5.0

    if score > 0:
        bm25_scores.append((score, idx))

bm25_scores.sort(key=lambda x: x[0], reverse=True)
t_bm25 = time.time() - t0
print(f"BM25 scoring {len(candidate_indices)} docs took: {t_bm25:.6f}s")

# Test 3: Cosine similarity
t0 = time.time()
sims = encoder.cosine_similarity_matrix(p_vec, retrieval._embedding_matrix)
top_sem_part = np.argpartition(sims, -50)[-50:]
t_cos = time.time() - t0
print(f"Cosine similarity (14606 docs) + argpartition took: {t_cos:.6f}s")

# Test 4: Database query TaxonomyCategory.objects.filter(...)
t0 = time.time()
cat_id = retrieval._category_docs[0]['category_id']
tc = TaxonomyCategory.objects.filter(taxonomy_version=active_version, id=cat_id).first()
t_db = time.time() - t0
print(f"Single TaxonomyCategory query took: {t_db:.6f}s")
