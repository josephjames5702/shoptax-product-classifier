import os
import json
import logging
import httpx
from typing import Dict, Any, List, Optional
from django.conf import settings

logger = logging.getLogger(__name__)

class LLMApprovalService:
    """
    Provider-agnostic service for final LLM-based taxonomy auto-approval validation.
    Enforces strict structured JSON output and prevents hallucinated taxonomy IDs.
    Supports Ollama and Deterministic Local fallback.
    """
    def __init__(self):
        self.provider = (os.environ.get('AI_PROVIDER') or getattr(settings, 'AI_PROVIDER', 'local')).lower()
        self.model = os.environ.get('AI_MODEL') or getattr(settings, 'AI_MODEL', '')

    def validate_classification(
        self,
        product_data: Dict[str, Any],
        candidates: List[Dict[str, Any]],
        image_local_path: Optional[str] = None,
        confidence_score: float = 0.0
    ) -> Dict[str, Any]:
        """
        Validates the product classification using a real local LLM or deterministic fallback.
        Returns a dictionary containing the structured decision.
        """
        if not candidates:
            return {
                "decision": "REJECTED",
                "selected_category_id": None,
                "reason_codes": ["NO_CANDIDATES_PROVIDED"],
                "confidence": 0.0,
                "error": "No candidates provided.",
                "ai_mode": "deterministic_local",
                "actual_provider": None,
                "actual_model": None,
                "ai_called": False
            }

        candidate_list_text = "\n".join([
            f"ID: {c['category_id']} | Path: {c['full_path']} | Name: {c['name']}"
            for c in candidates[:30]
        ])

        system_prompt = f"""
You are the final authority for e-commerce taxonomy classification.
You must select the single best Shopify Standard Product Taxonomy category for the given product.

CRITICAL RULES:
1. You MUST choose ONLY from the provided candidate IDs below.
2. If none of the candidates fit well, or the product data is ambiguous/insufficient, return NEEDS_CHANGES or REJECTED.
3. Your output must be STRICT JSON matching the schema exactly.

Product Details:
- Title: {product_data.get('title', '')}
- Description: {product_data.get('description', '')[:500]}
- Brand: {product_data.get('brand', '')}
- Product Type: {product_data.get('product_type', '')}
- Materials: {product_data.get('materials', '')}
- Color: {product_data.get('color', '')}

Candidate Categories (You MUST pick one of these IDs):
{candidate_list_text}

JSON Schema:
{{
  "decision": "APPROVED",
  "selected_category_id": "<ID from candidates or null>",
  "validated_attributes": [{{"name": "...", "value": "..."}}],
  "reason_codes": ["<short reason code>"],
  "confidence": 0.95
}}
"""

        try:
            if self.provider == 'ollama' and self._check_ollama_available():
                resp_data = self._call_ollama(system_prompt)
                ai_mode = "local_llm"
                ai_called = True
                actual_provider = "ollama"
                actual_model = self.model
            else:
                resp_data = self._deterministic_fallback(product_data, candidates, confidence_score)
                ai_mode = "deterministic_local"
                ai_called = False
                actual_provider = None
                actual_model = None
            
            # Post-validation
            decision = resp_data.get('decision')
            selected_id = str(resp_data.get('selected_category_id'))
            
            valid_ids = [str(c['category_id']) for c in candidates]

            if decision == 'APPROVED' and selected_id not in valid_ids:
                return {
                    "decision": "NEEDS_CHANGES",
                    "selected_category_id": None,
                    "reason_codes": ["INVALID_TAXONOMY_ID_HALLUCINATED"],
                    "confidence": 0.0,
                    "error": f"LLM hallucinated category ID: {selected_id}",
                    "ai_mode": ai_mode,
                    "actual_provider": actual_provider,
                    "actual_model": actual_model,
                    "ai_called": ai_called
                }
            
            resp_data['ai_mode'] = ai_mode
            resp_data['actual_provider'] = actual_provider
            resp_data['actual_model'] = actual_model
            resp_data['ai_called'] = ai_called
            return resp_data

        except httpx.HTTPStatusError as e:
            logger.error(f"Ollama API HTTP Error: {e.response.status_code}")
            raise
        except httpx.RequestError as e:
            logger.error(f"Ollama API Request Error: {e}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Ollama returned malformed JSON: {e}")
            raise ValueError(f"Malformed JSON from Ollama: {e}")

    _ollama_availability_cache: Optional[bool] = None
    _ollama_cache_timestamp: float = 0.0

    def _check_ollama_available(self) -> bool:
        if not self.model:
            return False
        import time
        now = time.time()
        if self._ollama_availability_cache is not None and (now - self._ollama_cache_timestamp) < 30.0:
            return self._ollama_availability_cache
        try:
            with httpx.Client(timeout=1.0) as client:
                resp = client.get("http://localhost:11434/api/tags")
                if resp.status_code == 200:
                    models = [m['name'] for m in resp.json().get('models', [])]
                    is_avail = any(self.model in m for m in models)
                    self._ollama_availability_cache = is_avail
                    self._ollama_cache_timestamp = now
                    return is_avail
        except Exception:
            pass
        self._ollama_availability_cache = False
        self._ollama_cache_timestamp = now
        return False

    def _call_ollama(self, prompt: str) -> Dict[str, Any]:
        url = "http://localhost:11434/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }
        with httpx.Client(timeout=120.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            text_content = resp.json().get('response', '')
            return json.loads(text_content)

    def _deterministic_fallback(self, product_data: Dict[str, Any], candidates: List[Dict[str, Any]], confidence_score: float) -> Dict[str, Any]:
        """
        Deterministic validation rules applied if Ollama is unavailable.
        Uses confidence score and heuristics to approve or flag for review.
        """
        top_candidate = candidates[0]
        
        # Multi-tiered score verification:
        # High confidence (>= 0.55): Approved / Classified (Automatically Approved based on score)
        # Medium confidence (0.48 <= score < 0.55): Needs Changes / Pending Manual Review
        # Low confidence (< 0.48): Rejected / Failed (Classified under Admin Declined)
        if confidence_score >= 0.55:
            decision = "APPROVED"
            reason_codes = ["HIGH_CONFIDENCE_MATCH"]
        elif confidence_score >= 0.48:
            decision = "NEEDS_CHANGES"
            reason_codes = ["MEDIUM_CONFIDENCE_NEEDS_REVIEW"]
        else:
            decision = "REJECTED"
            reason_codes = ["LOW_CONFIDENCE_BELOW_THRESHOLD"]

        return {
            "decision": decision,
            "selected_category_id": top_candidate.get('category_id') if top_candidate else None,
            "validated_attributes": [],
            "reason_codes": reason_codes,
            "confidence": confidence_score
        }
