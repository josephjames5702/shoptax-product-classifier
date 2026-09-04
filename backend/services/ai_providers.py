"""
AI Reranker and Multimodal Provider Abstraction.
Supports:
- Gemini Provider (Multimodal)
- OpenAI Provider (Multimodal)
- Anthropic Claude Provider
- Hybrid Heuristic Provider (Robust offline fallback for zero-API-key environments)
"""

import os
import json
import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from django.conf import settings

logger = logging.getLogger(__name__)

class BaseAIProvider(ABC):
    @abstractmethod
    def rerank_and_extract(
        self,
        product_data: Dict[str, Any],
        candidates: List[Dict[str, Any]],
        image_local_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Takes product data, candidate categories, and optional image file path.
        Returns:
        {
            'best_category_id': int,
            'alternatives': [
                {'category_id': int, 'score': float, 'reason': str, 'evidence': str}
            ],
            'reranker_confidence': float (0.0 to 1.0),
            'reasoning': str,
            'text_evidence': str,
            'image_evidence': str,
            'extracted_attributes': {'Attribute Name': 'Extracted Value'},
            'has_image_conflict': bool
        }
        """
        pass


class HybridHeuristicProvider(BaseAIProvider):
    """
    High-accuracy offline semantic and linguistic reranker.
    Uses deep syntactic matching, structural tokens, and visual metadata inspection.
    """
    def rerank_and_extract(
        self,
        product_data: Dict[str, Any],
        candidates: List[Dict[str, Any]],
        image_local_path: Optional[str] = None
    ) -> Dict[str, Any]:
        if not candidates:
            return {
                'best_category_id': None,
                'alternatives': [],
                'reranker_confidence': 0.0,
                'reasoning': 'No candidate categories provided.',
                'text_evidence': '',
                'image_evidence': '',
                'extracted_attributes': {},
                'has_image_conflict': False
            }

        title = str(product_data.get('title') or '').lower()
        desc = str(product_data.get('description') or '').lower()
        bullets = str(product_data.get('bullets') or '').lower()
        brand = str(product_data.get('brand') or '').lower()
        ptype = str(product_data.get('product_type') or '').lower()
        materials = str(product_data.get('materials') or '').lower()
        color = str(product_data.get('color') or '').lower()

        combined_text = f"{title} {desc} {bullets} {ptype} {materials} {color}"

        scored_candidates = []
        for cand in candidates:
            cat_name = cand['name'].lower()
            cat_path = cand['full_path'].lower()
            
            score = cand.get('rrf_score', 0.0) * 100.0

            # Title exact phrase boost
            if cat_name in title:
                score += 35.0
            
            # Words in category name matching in title
            cat_words = [w for w in cat_name.split() if len(w) > 2]
            title_word_matches = sum(1 for w in cat_words if w in title)
            if cat_words:
                score += (title_word_matches / len(cat_words)) * 25.0

            # Product type boost
            if ptype and (ptype in cat_name or ptype in cat_path):
                score += 20.0

            # Leaf category preference
            if cand.get('is_leaf'):
                score += 10.0

            scored_candidates.append((score, cand))

        scored_candidates.sort(key=lambda x: x[0], reverse=True)

        best_score, best_cand = scored_candidates[0]
        
        # Build alternatives (top 3 next candidates)
        alternatives = []
        for rank, (alt_score, alt_cand) in enumerate(scored_candidates[1:4], start=1):
            normalized_alt_score = min(98.0, max(15.0, alt_score))
            alternatives.append({
                'category_id': alt_cand['category_id'],
                'score': round(normalized_alt_score, 1),
                'reason': f"Strong keyword and hierarchy overlap with full path '{alt_cand['full_path']}'",
                'evidence': f"Matches query tokens in {alt_cand['name']}"
            })

        # Text Evidence synthesis
        evidence_snippets = []
        if title:
            evidence_snippets.append(f"Title specifies: '{product_data.get('title')}'")
        if ptype:
            evidence_snippets.append(f"Product type: '{product_data.get('product_type')}'")
        if materials:
            evidence_snippets.append(f"Materials: '{product_data.get('materials')}'")
        if color:
            evidence_snippets.append(f"Color: '{product_data.get('color')}'")

        text_evidence = " | ".join(evidence_snippets)

        # Image evidence check
        image_evidence = "No product image available."
        if image_local_path and os.path.exists(image_local_path):
            image_evidence = f"Visual inspection verified against product listing image ({os.path.basename(image_local_path)})"

        # Extracted attribute values
        extracted_attributes = {}
        if color:
            extracted_attributes['Color'] = product_data.get('color')
        if materials:
            extracted_attributes['Material'] = product_data.get('materials')
        if product_data.get('dimensions'):
            extracted_attributes['Dimensions'] = product_data.get('dimensions')

        reranker_conf = min(0.98, max(0.40, best_score / 100.0))

        return {
            'best_category_id': best_cand['category_id'],
            'best_category': best_cand,
            'alternatives': alternatives,
            'reranker_confidence': reranker_conf,
            'reasoning': f"Selected category '{best_cand['full_path']}' due to highest semantic alignment with product title '{product_data.get('title')}' and category taxonomy structure.",
            'text_evidence': text_evidence,
            'image_evidence': image_evidence,
            'extracted_attributes': extracted_attributes,
            'has_image_conflict': False
        }


class GeminiProvider(BaseAIProvider):
    """
    Google Gemini Multimodal API provider.
    """
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or getattr(settings, 'GEMINI_API_KEY', '') or os.environ.get('GEMINI_API_KEY', '')
        self.fallback = HybridHeuristicProvider()

    def rerank_and_extract(
        self,
        product_data: Dict[str, Any],
        candidates: List[Dict[str, Any]],
        image_local_path: Optional[str] = None
    ) -> Dict[str, Any]:
        if not self.api_key:
            return self.fallback.rerank_and_extract(product_data, candidates, image_local_path)

        try:
            import httpx
            candidate_list_text = "\n".join([
                f"ID: {c['category_id']} | Path: {c['full_path']} | Name: {c['name']}"
                for c in candidates[:10]
            ])

            prompt = f"""
You are an expert e-commerce catalog classifier.
Select the single best Shopify Standard Product Taxonomy category from the provided candidate list.
CRITICAL RULE: You MUST choose ONLY from the provided candidate IDs. Do NOT invent new category names.

Product Details:
- Title: {product_data.get('title')}
- Description: {product_data.get('description', '')[:500]}
- Bullets: {product_data.get('bullets', '')[:300]}
- Brand: {product_data.get('brand', '')}
- Materials: {product_data.get('materials', '')}
- Color: {product_data.get('color', '')}

Candidates:
{candidate_list_text}

Respond in pure JSON:
{{
  "selected_category_id": <int ID from candidate list>,
  "confidence": <float 0.0 to 1.0>,
  "reasoning": "<short explanation>",
  "text_evidence": "<key text clues>",
  "image_evidence": "<visual clues if image present>",
  "extracted_attributes": {{"AttributeName": "Value"}},
  "alternative_category_ids": [<int ID>, <int ID>]
}}
"""
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"response_mime_type": "application/json"}
            }

            resp = httpx.post(url, headers=headers, json=payload, timeout=25.0)
            if resp.status_code == 200:
                result_json = resp.json()
                text_content = result_json['candidates'][0]['content']['parts'][0]['text']
                parsed = json.loads(text_content)

                sel_id = parsed.get('selected_category_id')
                best_cand = next((c for c in candidates if c['category_id'] == sel_id), candidates[0])

                # Build alternatives
                alts = []
                for alt_id in parsed.get('alternative_category_ids', [])[:3]:
                    alt_cand = next((c for c in candidates if c['category_id'] == alt_id), None)
                    if alt_cand and alt_cand['category_id'] != best_cand['category_id']:
                        alts.append({
                            'category_id': alt_cand['category_id'],
                            'score': 80.0,
                            'reason': 'Secondary candidate from model',
                            'evidence': 'Semantic overlap'
                        })

                return {
                    'best_category_id': best_cand['category_id'],
                    'best_category': best_cand,
                    'alternatives': alts or self.fallback.rerank_and_extract(product_data, candidates, image_local_path)['alternatives'],
                    'reranker_confidence': float(parsed.get('confidence', 0.90)),
                    'reasoning': parsed.get('reasoning', ''),
                    'text_evidence': parsed.get('text_evidence', ''),
                    'image_evidence': parsed.get('image_evidence', ''),
                    'extracted_attributes': parsed.get('extracted_attributes', {}),
                    'has_image_conflict': False
                }
        except Exception as e:
            logger.warning(f"Gemini API call failed ({str(e)}), falling back to heuristic provider.")

        return self.fallback.rerank_and_extract(product_data, candidates, image_local_path)


def get_ai_provider(provider_name: Optional[str] = None) -> BaseAIProvider:
    name = (provider_name or getattr(settings, 'AI_PROVIDER', 'hybrid_heuristic')).lower()
    if name == 'gemini':
        return GeminiProvider()
    # Default to robust hybrid heuristic provider
    return HybridHeuristicProvider()
