"""
Production Sentence-Embedding Engine for Semantic Taxonomy Retrieval.
Computes dense 384-dimensional vector embeddings for category taxonomy documents and products,
caches taxonomy embeddings on disk/memory per active version, and computes cosine similarity.
Supports sentence-transformers (e.g. 'all-MiniLM-L6-v2') with a fast CPU-compatible fallback.
"""

import os
import json
import logging
import math
import pickle
import numpy as np
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Configurable embedding parameters
EMBEDDING_MODEL_NAME = os.environ.get('EMBEDDING_MODEL_NAME', 'all-MiniLM-L6-v2')
EMBEDDING_DIM = 384


class SentenceEmbeddingEngine:
    _instance = None
    _st_model = None

    def __init__(self):
        self.model_name = EMBEDDING_MODEL_NAME
        self.dim = EMBEDDING_DIM
        self._init_model()

    def _init_model(self):
        try:
            import torch
            torch.set_num_threads(os.cpu_count() or 4)
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading SentenceTransformer model '{self.model_name}'...")
            self._st_model = SentenceTransformer(self.model_name)
            logger.info("SentenceTransformer model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load SentenceTransformer ({e}). Genuine semantic retrieval requires this model.")
            raise RuntimeError(f"SentenceTransformer initialization failed: {e}")

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def encode_text(self, text: str) -> np.ndarray:
        """
        Encodes a text string into a normalized 384-dimensional dense semantic embedding vector.
        """
        if not text:
            return np.zeros(self.dim, dtype=np.float32)

        if self._st_model is None:
            raise RuntimeError("SentenceTransformer model is not loaded. Cannot perform semantic encoding.")

        try:
            vec = self._st_model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
            return vec.astype(np.float32)
        except Exception as e:
            logger.error(f"SentenceTransformer encode error ({e}).")
            raise RuntimeError(f"Semantic encoding failed: {e}")

    def batch_encode(self, texts: List[str]) -> np.ndarray:
        """
        Encodes a list of texts into a (N, 384) dense numpy matrix.
        """
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)

        if self._st_model is None:
            raise RuntimeError("SentenceTransformer model is not loaded. Cannot perform semantic batch encoding.")

        try:
            matrix = self._st_model.encode(texts, batch_size=256, show_progress_bar=False, convert_to_numpy=True, normalize_embeddings=True)
            return matrix.astype(np.float32)
        except Exception as e:
            logger.error(f"SentenceTransformer batch_encode error ({e}).")
            raise RuntimeError(f"Semantic batch encoding failed: {e}")

    def get_or_create_taxonomy_embeddings(self, version_code: str, texts: List[str]) -> np.ndarray:
        """
        Loads taxonomy embeddings from disk cache if available for version_code,
        otherwise precomputes and saves to disk cache.
        """
        cache_dir = os.path.join(os.path.dirname(__file__), "..", "scratch", "embeddings")
        os.makedirs(cache_dir, exist_ok=True)
        # Create a safe string for the model name to use in the file path
        safe_model_name = self.model_name.replace("/", "_").replace("\\", "_")
        cache_file = os.path.join(cache_dir, f"taxonomy_embeddings_{version_code}_{safe_model_name}.pkl")

        if os.path.exists(cache_file):
            try:
                with open(cache_file, "rb") as f:
                    cached_data = pickle.load(f)
                    if cached_data.get("count") == len(texts):
                        logger.info(f"Loaded {len(texts)} taxonomy embeddings from disk cache: {cache_file}")
                        return cached_data["matrix"]
            except Exception as e:
                logger.warning(f"Failed to load taxonomy embedding cache ({e}). Recomputing...")

        logger.info(f"Precomputing taxonomy embeddings for {len(texts)} categories...")
        matrix = self.batch_encode(texts)

        try:
            with open(cache_file, "wb") as f:
                pickle.dump({"count": len(texts), "matrix": matrix}, f)
            logger.info(f"Saved taxonomy embedding cache to {cache_file}")
        except Exception as e:
            logger.warning(f"Failed to save taxonomy embedding cache ({e}).")

        return matrix

    @staticmethod
    def cosine_similarity_matrix(query_vec: np.ndarray, doc_matrix: np.ndarray) -> np.ndarray:
        """
        Calculates cosine similarities between a 1D query vector (384,) and a 2D doc matrix (N, 384).
        Returns 1D array of floats (N,).
        """
        if doc_matrix.shape[0] == 0:
            return np.array([], dtype=np.float32)

        q_norm = np.linalg.norm(query_vec)
        if q_norm == 0:
            return np.zeros(doc_matrix.shape[0], dtype=np.float32)

        q_unit = query_vec / q_norm

        similarities = np.dot(doc_matrix, q_unit)
        return np.clip(similarities, 0.0, 1.0)
