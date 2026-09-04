"""
3-Stage Candidate Retrieval Engine:
- Stage A: BM25 Lexical Retrieval with precomputed IDF and fast inverted token index
- Stage B: True Sentence-Transformers Semantic Embeddings (dense normalized 384-dim vectors)
- Stage C: Reciprocal Rank Fusion (RRF k=60)
- Stage D: Hierarchical Taxonomy Reranking
"""

import os
import re
import math
import logging
import numpy as np
from collections import Counter
from typing import List, Dict, Any, Tuple, Optional
from django.conf import settings

from apps.taxonomy.models import TaxonomyVersion, TaxonomyCategory
from services.semantic_embedding import SentenceEmbeddingEngine

logger = logging.getLogger(__name__)


def tokenize(text: str) -> List[str]:
    if not text:
        return []
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', ' ', str(text)).lower()
    return [w for w in cleaned.split() if len(w) > 1]


class RetrievalService:
    _instance: Optional['RetrievalService'] = None

    def __init__(self):
        self._cached_version: Optional[TaxonomyVersion] = None
        self._category_docs: List[Dict[str, Any]] = []
        self._category_obj_map: Dict[int, TaxonomyCategory] = {}
        self._bm25_idf: Dict[str, float] = {}
        self._inverted_token_index: Dict[str, List[int]] = {}
        self._embedding_matrix: Optional[np.ndarray] = None
        self._avg_dl: float = 0.0

    def get_category_by_id(self, category_id: int) -> Optional[TaxonomyCategory]:
        return self._category_obj_map.get(category_id)

    @classmethod
    def get_instance(cls) -> 'RetrievalService':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def clear_cache(cls):
        if cls._instance:
            cls._instance._cached_version = None
            cls._instance._category_docs = []
            cls._instance._category_obj_map = {}
            cls._instance._bm25_idf = {}
            cls._instance._inverted_token_index = {}
            cls._instance._embedding_matrix = None

    def _ensure_taxonomy_index(self, active_version: TaxonomyVersion):
        """
        Precomputes and caches taxonomy search documents, inverted token index,
        and dense sentence-embedding matrix once per active taxonomy version.
        NEVER recomputed per product.
        """
        current_cat_count = TaxonomyCategory.objects.filter(taxonomy_version=active_version).count()
        if (
            self._cached_version is not None and
            self._cached_version.id == active_version.id and
            self._category_docs is not None and
            len(self._category_docs) == current_cat_count and
            current_cat_count > 0 and
            TaxonomyCategory.objects.filter(id=self._category_docs[0]['category_id'], taxonomy_version=active_version).exists()
        ):
            return

        logger.info(f"Building precomputed taxonomy search index and sentence embeddings for version '{active_version.version_code}'...")

        categories = list(
            TaxonomyCategory.objects.filter(taxonomy_version=active_version)
            .select_related('parent')
            .prefetch_related('category_attributes__attribute')
        )

        cat_map = {c.id: c for c in categories}
        docs = []
        vocab_freq = {}
        inverted_index: Dict[str, List[int]] = {}
        doc_texts = []
        total_len = 0

        for idx, c in enumerate(categories):
            parent_name = c.parent.name if c.parent else ""
            ancestor_names = [cat_map[aid].name for aid in c.ancestor_ids if aid in cat_map]
            root_context = ancestor_names[0] if ancestor_names else c.name
            attr_names = [ca.attribute.name for ca in c.category_attributes.all()]

            # Build search document from actual taxonomy fields
            doc_text = f"{c.name}. Full path: {c.full_path}. Parent: {parent_name}. Vertical: {root_context}. Attributes: {' '.join(attr_names)}"
            tokens = tokenize(doc_text)
            term_counts = Counter(tokens)
            doc_texts.append(doc_text)
            total_len += len(tokens)

            for t in set(tokens):
                vocab_freq[t] = vocab_freq.get(t, 0) + 1
                if t not in inverted_index:
                    inverted_index[t] = []
                inverted_index[t].append(idx)

            docs.append({
                'category_id': c.id,
                'external_id': c.external_id,
                'name': c.name,
                'full_path': c.full_path,
                'level': c.level,
                'is_leaf': c.is_leaf,
                'is_root': c.is_root,
                'tokens': tokens,
                'token_set': set(tokens),
                'term_counts': term_counts,
                'doc_text': doc_text,
            })

        # Precompute BM25 IDF weights
        total_docs = len(docs)
        bm25_idf = {term: math.log((total_docs - freq + 0.5) / (freq + 0.5) + 1.0) for term, freq in vocab_freq.items()}
        avg_dl = (total_len / max(1, total_docs))

        # Precompute/Load Dense Sentence-Embedding Matrix (N, 384) once for all categories
        logger.info(f"Retrieving or precomputing sentence vector embeddings for {total_docs} categories...")
        encoder = SentenceEmbeddingEngine.get_instance()
        embedding_matrix = encoder.get_or_create_taxonomy_embeddings(active_version.version_code, doc_texts)

        self._category_docs = docs
        self._category_obj_map = cat_map
        self._bm25_idf = bm25_idf
        self._inverted_token_index = inverted_index
        self._avg_dl = avg_dl
        self._embedding_matrix = embedding_matrix
        self._cached_version = active_version

        logger.info(f"Taxonomy index ready: {len(docs)} categories indexed with shape {embedding_matrix.shape}.")

    def retrieve_candidates(
        self,
        product_data: Dict[str, Any],
        top_k_bm25: int = 50,
        top_k_semantic: int = 50,
        top_k_rrf: int = 30,
        top_k_final: int = 10,
        top_k: Optional[int] = None,
        product_vector: Optional[np.ndarray] = None,
    ) -> List[Dict[str, Any]]:
        """
        Executes 3-Stage Candidate Retrieval:
        Stage A: BM25 Lexical Retrieval
        Stage B: Sentence-Embedding Semantic Retrieval
        Stage C: Reciprocal Rank Fusion (RRF)
        Stage D: Hierarchical Reranking
        """
        active_version = TaxonomyVersion.objects.filter(is_active=True).first()
        if not active_version:
            raise ValueError("No active TaxonomyVersion found in database.")

        self._ensure_taxonomy_index(active_version)

        if isinstance(product_data, str):
            product_data = {'title': product_data}

        title = str(product_data.get('title') or '')
        desc = str(product_data.get('description') or '')
        bullets = str(product_data.get('bullets') or '')
        ptype = str(product_data.get('product_type') or '')
        brand = str(product_data.get('brand') or '')
        materials = str(product_data.get('materials') or '')
        color = str(product_data.get('color') or '')

        # Build query text strictly excluding supplier category fields (Data Leakage Safeguard!)
        query_text = f"{title} {ptype} {brand} {materials} {color} {bullets[:200]} {desc[:300]}"
        query_tokens = tokenize(query_text)
        query_set = set(query_tokens)
        title_lower = title.lower()

        # --- STAGE A: Fast BM25 Lexical Retrieval using Inverted Index ---
        k1 = 1.5
        b = 0.75
        avg_dl = self._avg_dl or 20.0

        # Pre-filter candidate indices using inverted index
        candidate_indices = set()
        for t in query_set:
            if t in self._inverted_token_index:
                candidate_indices.update(self._inverted_token_index[t])

        bm25_scores = []
        for idx in candidate_indices:
            d = self._category_docs[idx]
            matching_tokens = query_set & d['token_set']

            score = 0.0
            doc_len = len(d['tokens'])
            term_counts = d['term_counts']

            for t in matching_tokens:
                tf = term_counts[t]
                idf_val = self._bm25_idf.get(t, 1.0)
                denom = tf + k1 * (1 - b + b * (doc_len / avg_dl))
                score += idf_val * ((tf * (k1 + 1)) / denom)

            if d['name'].lower() in title_lower:
                score += 5.0

            if score > 0:
                bm25_scores.append((score, idx))

        bm25_scores.sort(key=lambda x: x[0], reverse=True)
        top_bm25_indices = [idx for _, idx in bm25_scores[:top_k_bm25]]

        # --- STAGE B: True Sentence-Embedding Semantic Retrieval ---
        encoder = SentenceEmbeddingEngine.get_instance()
        product_vec = product_vector if product_vector is not None else encoder.encode_text(query_text)
        semantic_sims = encoder.cosine_similarity_matrix(product_vec, self._embedding_matrix)

        if len(semantic_sims) > top_k_semantic:
            top_sem_part = np.argpartition(semantic_sims, -top_k_semantic)[-top_k_semantic:]
            top_semantic_indices = sorted(top_sem_part.tolist(), key=lambda idx: semantic_sims[idx], reverse=True)
        else:
            top_semantic_indices = sorted(list(range(len(semantic_sims))), key=lambda idx: semantic_sims[idx], reverse=True)

        # --- STAGE C: Reciprocal Rank Fusion (RRF) ---
        rrf_map: Dict[int, float] = {}
        k_rrf = 60.0

        for rank, idx in enumerate(top_bm25_indices, start=1):
            rrf_map[idx] = rrf_map.get(idx, 0.0) + (1.0 / (k_rrf + rank))

        for rank, idx in enumerate(top_semantic_indices, start=1):
            rrf_map[idx] = rrf_map.get(idx, 0.0) + (1.0 / (k_rrf + rank))

        sorted_rrf = sorted(rrf_map.items(), key=lambda x: x[1], reverse=True)[:top_k_rrf]

        # --- STAGE D: Hierarchical Reranking & Final Candidate Assembly ---
        final_candidates = []
        bm25_score_dict = dict(bm25_scores)

        for rank, (idx, rrf_score) in enumerate(sorted_rrf, start=1):
            doc = self._category_docs[idx]
            sem_sim = float(semantic_sims[idx])
            bm25_s = float(bm25_score_dict.get(idx, 0.0))

            hierarchical_boost = 1.0
            if doc['is_leaf']:
                hierarchical_boost += 0.15
            if doc['level'] >= 2:
                hierarchical_boost += 0.10

            final_candidates.append({
                'category_id': doc['category_id'],
                'external_id': doc['external_id'],
                'name': doc['name'],
                'full_path': doc['full_path'],
                'level': doc['level'],
                'is_leaf': doc['is_leaf'],
                'is_root': doc['is_root'],
                'bm25_score': round(bm25_s, 4),
                'semantic_similarity_score': round(sem_sim, 4),
                'rrf_score': round(rrf_score, 6),
                'final_retrieval_score': round(rrf_score * hierarchical_boost, 6),
                'doc_text': doc['doc_text'],
            })

        final_candidates.sort(key=lambda x: x['final_retrieval_score'], reverse=True)
        return final_candidates[:top_k_final]
