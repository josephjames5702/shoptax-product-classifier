"""
Taxonomy Attribute Extraction and Value Validation Service.
Ensures:
- Every predicted attribute is valid for the selected category.
- Every predicted attribute value is checked against Shopify's allowed taxonomy values.
- Uncontrolled / free-form values are normalized and flagged appropriately.
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from apps.taxonomy.models import TaxonomyCategory, TaxonomyAttribute, TaxonomyAttributeValue, CategoryAttribute
from apps.products.models import Product

logger = logging.getLogger(__name__)

class ValidationService:
    @staticmethod
    def _normalize_text(text: str) -> str:
        if not text:
            return ''
        cleaned = re.sub(r'[^a-zA-Z0-9\s]', '', text.lower())
        return re.sub(r'\s+', ' ', cleaned).strip()

    def extract_and_validate_attributes(
        self,
        product: Product,
        category: TaxonomyCategory,
        ai_extracted_attributes: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Extracts attribute values from structured product fields + AI outputs,
        and validates them against Shopify's allowed attribute values for the category.
        """
        # Fetch valid attributes assigned to this category
        cat_attrs = CategoryAttribute.objects.filter(
            category=category
        ).select_related('attribute').prefetch_related('attribute__values')

        valid_attributes = {ca.attribute.name.lower(): ca.attribute for ca in cat_attrs}
        # Also map by handle
        valid_handles = {ca.attribute.handle: ca.attribute for ca in cat_attrs if ca.attribute.handle}

        results = []

        # Structured source fields mapping
        field_mappings = {
            'color': product.color,
            'materials': product.materials,
            'finish': product.color_collection,
            'dimensions': product.dimensions,
            'set': product.set_includes,
        }

        ai_extracted = ai_extracted_attributes or {}

        for ca in cat_attrs:
            attr = ca.attribute
            attr_name_lower = attr.name.lower()
            raw_val = None
            source = 'STRUCTURED'

            # 1. Check AI extracted output first
            if attr.name in ai_extracted:
                raw_val = ai_extracted[attr.name]
                source = 'MULTIMODAL' if product.images.filter(status='DOWNLOADED').exists() else 'TEXT'
            elif attr.handle in ai_extracted:
                raw_val = ai_extracted[attr.handle]
                source = 'TEXT'
            elif attr_name_lower in ai_extracted:
                raw_val = ai_extracted[attr_name_lower]
                source = 'TEXT'

            # 2. Check structured fields fallback
            if not raw_val:
                for k, v in field_mappings.items():
                    if k in attr_name_lower and v:
                        raw_val = v
                        source = 'STRUCTURED'
                        break

            # 3. Text search in title / description / bullets if still missing
            if not raw_val:
                search_corpus = f"{product.title} {product.description} {product.bullets}"
                allowed_vals = list(attr.values.all())
                for av in allowed_vals:
                    # Match whole word
                    pattern = r'\b' + re.escape(av.name.lower()) + r'\b'
                    if re.search(pattern, search_corpus.lower()):
                        raw_val = av.name
                        source = 'TEXT'
                        break

            if not raw_val:
                continue

            # Validate against allowed taxonomy values
            allowed_values_qs = attr.values.all()
            is_valid = False
            normalized_val = str(raw_val).strip()

            if allowed_values_qs.exists():
                norm_raw = self._normalize_text(str(raw_val))
                for av in allowed_values_qs:
                    if av.normalized_name == norm_raw or self._normalize_text(av.name) == norm_raw:
                        is_valid = True
                        normalized_val = av.name
                        break
                    # Partial / substring match
                    if len(av.normalized_name) > 3 and av.normalized_name in norm_raw:
                        is_valid = True
                        normalized_val = av.name
                        break
            else:
                # Free-form string / number attribute
                is_valid = True

            results.append({
                'attribute': attr,
                'raw_value': str(raw_val),
                'normalized_value': normalized_val,
                'is_valid_taxonomy_value': is_valid,
                'source': source,
                'confidence': 0.95 if is_valid else 0.70,
            })

        return results
