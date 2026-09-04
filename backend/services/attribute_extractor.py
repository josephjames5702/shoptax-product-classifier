"""
Attribute Value Extraction and Controlled Taxonomy Value Matcher.
Matches extracted values against official TaxonomyAttributeValue records in the active database.
Never invents Shopify attribute values outside the active taxonomy.
Uses in-memory caching to eliminate redundant database hits during batch classification.
"""

import re
import logging
from typing import Dict, Any, List, Optional
from apps.taxonomy.models import TaxonomyCategory, TaxonomyAttribute, TaxonomyAttributeValue, CategoryAttribute

logger = logging.getLogger(__name__)

def normalize_text_value(val: str) -> str:
    if not val:
        return ""
    cleaned = re.sub(r'[^a-zA-Z0-9\s-]', '', str(val)).strip().lower()
    return re.sub(r'\s+', ' ', cleaned)


class AttributeExtractor:
    _cat_attr_cache: Dict[int, List[Dict[str, Any]]] = {}

    @classmethod
    def get_category_attributes(cls, category: Any) -> List[Dict[str, Any]]:
        cat_id = category.id if hasattr(category, 'id') else (category.get('category_id') if isinstance(category, dict) else int(category))
        if cat_id in cls._cat_attr_cache:
            return cls._cat_attr_cache[cat_id]

        if hasattr(category, 'category_attributes'):
            try:
                cat_attributes = list(category.category_attributes.all())
                if cat_attributes:
                    cached_list = []
                    for ca in cat_attributes:
                        attr = ca.attribute
                        values = list(attr.values.all()) if hasattr(attr, 'values') else []
                        cached_list.append({
                            'attr_id': attr.id,
                            'attr_name': attr.name,
                            'attr_name_norm': normalize_text_value(attr.name),
                            'attr_handle': attr.handle.lower() if attr.handle else "",
                            'allowed_values': [
                                {
                                    'id': v.id,
                                    'name': v.name,
                                    'name_norm': normalize_text_value(v.name),
                                    'handle': v.handle.lower() if v.handle else "",
                                    'val_obj': v,
                                }
                                for v in values
                            ]
                        })
                    cls._cat_attr_cache[cat_id] = cached_list
                    return cached_list
            except Exception:
                pass

        cat_attributes = CategoryAttribute.objects.filter(
            category_id=cat_id
        ).select_related('attribute').prefetch_related('attribute__values')

        cached_list = []
        for ca in cat_attributes:
            attr = ca.attribute
            values = list(attr.values.all())
            cached_list.append({
                'attr_id': attr.id,
                'attr_name': attr.name,
                'attr_name_norm': normalize_text_value(attr.name),
                'attr_handle': attr.handle.lower() if attr.handle else "",
                'allowed_values': [
                    {
                        'id': v.id,
                        'name': v.name,
                        'name_norm': normalize_text_value(v.name),
                        'handle': v.handle.lower() if v.handle else "",
                        'val_obj': v,
                    }
                    for v in values
                ]
            })

        cls._cat_attr_cache[cat_id] = cached_list
        return cached_list

    @classmethod
    def extract_and_match(
        cls,
        category: TaxonomyCategory,
        product_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Extracts values for assigned attributes of category and validates against
        TaxonomyAttributeValue records.
        """
        attr_data_list = cls.get_category_attributes(category)
        results = []

        title = str(product_data.get('title') or '')
        bullets = str(product_data.get('bullets') or '')
        desc = str(product_data.get('description') or '')
        combined_text = f"{title} {bullets} {desc}".lower()

        field_sources = {
            'color': str(product_data.get('color') or ''),
            'materials': str(product_data.get('materials') or ''),
            'dimensions': str(product_data.get('dimensions') or ''),
            'brand': str(product_data.get('brand') or ''),
        }

        for attr_item in attr_data_list:
            attr_name_norm = attr_item['attr_name_norm']
            allowed_values = attr_item['allowed_values']

            raw_val = ""
            source_type = "TEXT"

            # 1. Check direct structured fields first
            if 'color' in attr_name_norm or 'finish' in attr_name_norm:
                raw_val = field_sources['color']
                source_type = "STRUCTURED"
            elif 'material' in attr_name_norm or 'fabric' in attr_name_norm:
                raw_val = field_sources['materials']
                source_type = "STRUCTURED"
            elif 'dimension' in attr_name_norm or 'size' in attr_name_norm:
                raw_val = field_sources['dimensions']
                source_type = "STRUCTURED"
            elif 'brand' in attr_name_norm:
                raw_val = field_sources['brand']
                source_type = "STRUCTURED"

            # 2. If empty in structured fields, attempt text keyword matching against allowed values
            if not raw_val and allowed_values:
                for val_item in allowed_values:
                    v_name = val_item['name'].lower()
                    if len(v_name) > 2 and v_name in combined_text:
                        raw_val = val_item['name']
                        source_type = "TEXT"
                        break

            if not raw_val:
                continue

            # 3. Controlled Taxonomy Value Matcher
            norm_raw = normalize_text_value(raw_val)
            matched_val_dict: Optional[Dict[str, Any]] = None

            for val_item in allowed_values:
                v_norm = val_item['name_norm']
                v_handle = val_item['handle']
                
                # Exact or normalized match
                if norm_raw == v_norm or norm_raw == v_handle:
                    matched_val_dict = val_item
                    break
                # Substring/Synonym match
                if len(v_norm) > 2 and (v_norm in norm_raw or norm_raw in v_norm):
                    matched_val_dict = val_item
                    break

            if matched_val_dict:
                results.append({
                    'attribute_id': attr_item['attr_id'],
                    'attribute_name': attr_item['attr_name'],
                    'raw_value': raw_val,
                    'normalized_value': matched_val_dict['name'],
                    'value_id': matched_val_dict['id'],
                    'is_valid_taxonomy_value': True,
                    'source': source_type,
                    'confidence': 1.0,
                })
            else:
                results.append({
                    'attribute_id': attr_item['attr_id'],
                    'attribute_name': attr_item['attr_name'],
                    'raw_value': raw_val,
                    'normalized_value': raw_val.strip(),
                    'value_id': None,
                    'is_valid_taxonomy_value': False,
                    'source': source_type,
                    'confidence': 0.60,
                })

        return results
