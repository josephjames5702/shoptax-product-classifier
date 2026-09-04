"""
Taxonomy Service providing fast cached lookups for hierarchy, attributes, allowed values, and lexical search.
"""

import logging
from typing import List, Dict, Any, Optional, Set
from django.db.models import Q
from apps.taxonomy.models import (
    TaxonomyVersion,
    TaxonomyCategory,
    TaxonomyAttribute,
    TaxonomyAttributeValue,
    CategoryAttribute,
)

logger = logging.getLogger(__name__)


class TaxonomyService:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_active_version(self) -> Optional[TaxonomyVersion]:
        return TaxonomyVersion.objects.filter(is_active=True).first()

    def get_category_by_id(self, category_id: int) -> Optional[TaxonomyCategory]:
        try:
            return TaxonomyCategory.objects.get(id=category_id)
        except TaxonomyCategory.DoesNotExist:
            return None

    def get_category_by_external_id(self, external_id: str, version_code: Optional[str] = None) -> Optional[TaxonomyCategory]:
        qs = TaxonomyCategory.objects.filter(external_id=external_id)
        if version_code:
            qs = qs.filter(taxonomy_version__version_code=version_code)
        else:
            qs = qs.filter(taxonomy_version__is_active=True)
        return qs.first()

    def get_category_by_path(self, full_path: str, version_code: Optional[str] = None) -> Optional[TaxonomyCategory]:
        qs = TaxonomyCategory.objects.filter(full_path__iexact=full_path.strip())
        if version_code:
            qs = qs.filter(taxonomy_version__version_code=version_code)
        else:
            qs = qs.filter(taxonomy_version__is_active=True)
        return qs.first()

    def search_categories(self, query: str, limit: int = 20, version_code: Optional[str] = None) -> List[TaxonomyCategory]:
        """
        Fast non-AI lexical search for category paths, names, and IDs.
        """
        qs = TaxonomyCategory.objects.all()
        if version_code:
            qs = qs.filter(taxonomy_version__version_code=version_code)
        else:
            qs = qs.filter(taxonomy_version__is_active=True)

        query_clean = query.strip()
        if not query_clean:
            return list(qs.filter(is_root=True)[:limit])

        return list(
            qs.filter(
                Q(name__icontains=query_clean) |
                Q(full_path__icontains=query_clean) |
                Q(external_id__icontains=query_clean)
            )[:limit]
        )

    def get_root_categories(self, version_code: Optional[str] = None) -> List[TaxonomyCategory]:
        qs = TaxonomyCategory.objects.filter(is_root=True)
        if version_code:
            qs = qs.filter(taxonomy_version__version_code=version_code)
        else:
            qs = qs.filter(taxonomy_version__is_active=True)
        return list(qs.order_by('name'))

    def get_children(self, category_id: int) -> List[TaxonomyCategory]:
        return list(TaxonomyCategory.objects.filter(parent_id=category_id).order_by('name'))

    def get_leaf_categories(self, version_code: Optional[str] = None) -> List[TaxonomyCategory]:
        qs = TaxonomyCategory.objects.filter(is_leaf=True)
        if version_code:
            qs = qs.filter(taxonomy_version__version_code=version_code)
        else:
            qs = qs.filter(taxonomy_version__is_active=True)
        return list(qs.select_related('parent'))

    def get_category_attributes_with_values(self, category) -> List[Dict[str, Any]]:
        """
        Retrieves all assigned attributes and their allowed values for a given category instance or ID.
        """
        if isinstance(category, (int, str)):
            cat_obj = TaxonomyCategory.objects.filter(id=category).first()
            if not cat_obj:
                return []
            category = cat_obj

        cat_attrs = CategoryAttribute.objects.filter(
            category=category
        ).select_related('attribute').prefetch_related('attribute__values')

        results = []
        for ca in cat_attrs:
            attr = ca.attribute
            values = [
                {
                    'id': str(v.id),
                    'external_id': v.external_id,
                    'name': v.name,
                    'handle': v.handle,
                    'normalized_name': v.normalized_name,
                }
                for v in attr.values.all()
            ]
            results.append({
                'attribute_id': str(attr.id),
                'external_id': attr.external_id,
                'name': attr.name,
                'attribute_name': attr.name,
                'handle': attr.handle,
                'description': attr.description,
                'is_required': ca.is_required,
                'is_extended': ca.is_extended,
                'allowed_values': values,
            })
        return results
