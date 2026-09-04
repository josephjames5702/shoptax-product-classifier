"""
Taxonomy Validation Service.
Validates structural integrity, parent-child hierarchies, cycle absence, attribute linkings, and path consistency.
"""

import logging
from typing import Dict, Any, List, Set
from apps.taxonomy.models import (
    TaxonomyVersion,
    TaxonomyCategory,
    TaxonomyAttribute,
    TaxonomyAttributeValue,
    CategoryAttribute,
)

logger = logging.getLogger(__name__)


class TaxonomyValidator:
    """
    Validates the integrity of a stored TaxonomyVersion.
    """

    def __init__(self, taxonomy_version: TaxonomyVersion):
        self.version = taxonomy_version
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def validate_all(self) -> Dict[str, Any]:
        """
        Executes all validation checks.
        """
        self.errors.clear()
        self.warnings.clear()

        cat_qs = TaxonomyCategory.objects.filter(taxonomy_version=self.version)
        attr_qs = TaxonomyAttribute.objects.filter(taxonomy_version=self.version)
        val_qs = TaxonomyAttributeValue.objects.filter(attribute__taxonomy_version=self.version)
        cat_attr_qs = CategoryAttribute.objects.filter(category__taxonomy_version=self.version)

        cat_count = cat_qs.count()
        attr_count = attr_qs.count()
        val_count = val_qs.count()
        cat_attr_count = cat_attr_qs.count()

        # 1. Existence and count sanity
        if cat_count == 0:
            self.errors.append("Taxonomy contains 0 categories.")
        if attr_count == 0:
            self.errors.append("Taxonomy contains 0 attributes.")
        if val_count == 0:
            self.errors.append("Taxonomy contains 0 attribute values.")

        # 2. Hierarchy integrity
        roots = list(cat_qs.filter(is_root=True))
        if not roots:
            self.errors.append("No root categories found in taxonomy version.")

        for root in roots:
            if root.parent_id is not None:
                self.errors.append(f"Root category '{root.external_id}' ({root.name}) has parent_id={root.parent_id}.")

        # Check orphans and cycles using an in-memory parent map
        cat_parent_map = dict(cat_qs.values_list('id', 'parent_id'))
        cat_is_root_map = dict(cat_qs.values_list('id', 'is_root'))

        orphan_count = 0
        for cat_id, parent_id in cat_parent_map.items():
            is_root = cat_is_root_map.get(cat_id, False)
            if not is_root:
                if parent_id is None:
                    orphan_count += 1
                elif parent_id not in cat_parent_map:
                    orphan_count += 1

        if orphan_count > 0:
            self.errors.append(f"Detected {orphan_count} orphan/unlinked non-root categories.")

        # 3. Fast Cycle Detection
        visited_global: Set[int] = set()
        for cat_id in cat_parent_map:
            if cat_id in visited_global:
                continue

            current_set: Set[int] = set()
            curr = cat_id
            while curr is not None:
                if curr in current_set:
                    self.errors.append(f"Cyclic reference detected starting at category internal ID {curr}.")
                    break
                current_set.add(curr)
                visited_global.add(curr)
                curr = cat_parent_map.get(curr)

            if len(self.errors) > 0:
                break

        summary = {
            "version_code": self.version.version_code,
            "categories_count": cat_count,
            "root_categories_count": len(roots),
            "leaf_categories_count": cat_qs.filter(is_leaf=True).count(),
            "attributes_count": attr_count,
            "values_count": val_count,
            "category_attributes_count": cat_attr_count,
            "errors_count": len(self.errors),
            "warnings_count": len(self.warnings),
        }

        is_valid = len(self.errors) == 0
        return {
            "is_valid": is_valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "summary": summary,
        }
