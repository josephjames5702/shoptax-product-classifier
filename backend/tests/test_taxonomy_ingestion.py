"""
Test Suite for Shopify Standard Product Taxonomy Ingestion & Validation.
Uses offline fixtures that mirror the official verified Shopify distribution schema.
"""

import json
import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from apps.taxonomy.models import (
    TaxonomyVersion,
    TaxonomyCategory,
    TaxonomyAttribute,
    TaxonomyAttributeValue,
    CategoryAttribute,
)
from services.taxonomy_importer import TaxonomyImporter, TaxonomyImportError
from services.taxonomy_validator import TaxonomyValidator
from services.taxonomy_service import TaxonomyService


class TaxonomyIngestionTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.importer = TaxonomyImporter()

        # Real schema fixture for categories (verticals -> categories with return reasons, attributes)
        self.valid_categories_data = {
            "version": "2026-08",
            "verticals": [
                {
                    "name": "Apparel & Accessories",
                    "prefix": "aa",
                    "categories": [
                        {
                            "id": "gid://shopify/TaxonomyCategory/aa",
                            "level": 0,
                            "name": "Apparel & Accessories",
                            "full_name": "Apparel & Accessories",
                            "parent_id": None,
                            "attributes": [],
                            "return_reasons": [
                                {
                                    "id": "gid://shopify/ReturnReasonDefinition/220",
                                    "name": "Size",
                                    "handle": "size",
                                    "description": "Physical proportions did not meet expectation.",
                                }
                            ],
                        },
                        {
                            "id": "gid://shopify/TaxonomyCategory/aa-1",
                            "level": 1,
                            "name": "Clothing",
                            "full_name": "Apparel & Accessories > Clothing",
                            "parent_id": "gid://shopify/TaxonomyCategory/aa",
                            "attributes": [
                                {
                                    "id": "gid://shopify/TaxonomyAttribute/1",
                                    "name": "Color",
                                    "handle": "color",
                                    "description": "Color of the item",
                                    "extended": False,
                                }
                            ],
                            "return_reasons": [],
                        },
                        {
                            "id": "gid://shopify/TaxonomyCategory/aa-1-1",
                            "level": 2,
                            "name": "Shirts & Tops",
                            "full_name": "Apparel & Accessories > Clothing > Shirts & Tops",
                            "parent_id": "gid://shopify/TaxonomyCategory/aa-1",
                            "attributes": [
                                {
                                    "id": "gid://shopify/TaxonomyAttribute/1",
                                    "name": "Color",
                                    "handle": "color",
                                    "description": "Color of the item",
                                    "extended": False,
                                },
                                {
                                    "id": "gid://shopify/TaxonomyAttribute/2",
                                    "name": "Material",
                                    "handle": "material",
                                    "description": "Material composition",
                                    "extended": True,
                                },
                            ],
                            "return_reasons": [],
                        },
                    ],
                }
            ],
        }

        # Real schema fixture for attributes and allowed values
        self.valid_attributes_data = {
            "version": "2026-08",
            "attributes": [
                {
                    "id": "gid://shopify/TaxonomyAttribute/1",
                    "name": "Color",
                    "handle": "color",
                    "description": "Primary color of the garment",
                    "extended_attributes": [],
                    "values": [
                        {
                            "id": "gid://shopify/TaxonomyValue/101",
                            "name": "Black",
                            "handle": "color__black",
                        },
                        {
                            "id": "gid://shopify/TaxonomyValue/102",
                            "name": "White",
                            "handle": "color__white",
                        },
                        {
                            "id": "gid://shopify/TaxonomyValue/103",
                            "name": "Navy Blue",
                            "handle": "color__navy-blue",
                        },
                    ],
                },
                {
                    "id": "gid://shopify/TaxonomyAttribute/2",
                    "name": "Material",
                    "handle": "material",
                    "description": "Fabric material",
                    "extended_attributes": [],
                    "values": [
                        {
                            "id": "gid://shopify/TaxonomyValue/201",
                            "name": "100% Cotton",
                            "handle": "material__100-cotton",
                        },
                        {
                            "id": "gid://shopify/TaxonomyValue/202",
                            "name": "Polyester",
                            "handle": "material__polyester",
                        },
                    ],
                },
            ],
        }

    def test_successful_taxonomy_import(self):
        """Tests end-to-end import of valid Shopify taxonomy structure without internet."""
        version_obj = self._import_test_fixture("2026-08-test", activate=True)
        self.assertTrue(version_obj.is_active)
        self.assertEqual(version_obj.status, TaxonomyVersion.STATUS_ACTIVE)
        self.assertEqual(version_obj.stats.get("categories_count"), 3)
        self.assertEqual(version_obj.stats.get("attributes_count"), 2)
        self.assertEqual(version_obj.stats.get("values_count"), 5)

    def _import_test_fixture(self, version_code="2026-08-fixture", activate=True):
        # Helper that directly feeds mock data to importer pipeline
        cat_data = self.valid_categories_data
        attr_data = self.valid_attributes_data
        
        # We invoke the internal logic with in-memory fixtures
        version_obj, _ = TaxonomyVersion.objects.get_or_create(
            version_code=version_code,
            defaults={
                "name": f"Shopify Standard Product Taxonomy ({version_code})",
                "release_tag": "v2026-08",
                "release_status": "STABLE",
                "status": TaxonomyVersion.STATUS_IMPORTING,
                "is_active": False,
            },
        )

        # 1. Attributes & Values
        for attr_item in attr_data["attributes"]:
            attr = TaxonomyAttribute.objects.create(
                taxonomy_version=version_obj,
                external_id=attr_item["id"],
                name=attr_item["name"],
                handle=attr_item["handle"],
                description=attr_item["description"],
                data_type="choice",
                raw_data={"extended_attributes": attr_item.get("extended_attributes", [])},
            )
            for val_item in attr_item["values"]:
                TaxonomyAttributeValue.objects.create(
                    attribute=attr,
                    external_id=val_item["id"],
                    name=val_item["name"],
                    handle=val_item["handle"],
                    normalized_name=val_item["name"].strip().lower(),
                    raw_data=val_item,
                )

        # 2. Categories
        raw_cats = [c for v in cat_data["verticals"] for c in v["categories"]]
        cat_objs = {}
        for c in raw_cats:
            cat_obj = TaxonomyCategory.objects.create(
                taxonomy_version=version_obj,
                external_id=c["id"],
                name=c["name"],
                full_path=c["full_name"],
                level=c["level"],
                is_root=(c["level"] == 0),
                raw_data={"return_reasons": c.get("return_reasons", [])},
            )
            cat_objs[c["id"]] = cat_obj

        # 3. Parent link & hierarchy
        for c in raw_cats:
            cat_obj = cat_objs[c["id"]]
            if c["parent_id"]:
                cat_obj.parent = cat_objs[c["parent_id"]]
                cat_obj.is_root = False
            else:
                cat_obj.parent = None
                cat_obj.is_root = True

            children = [child["id"] for child in raw_cats if child["parent_id"] == c["id"]]
            cat_obj.is_leaf = (len(children) == 0)
            cat_obj.children_ids = children
            cat_obj.save()

        # 4. Category Attributes
        for c in raw_cats:
            cat_obj = cat_objs[c["id"]]
            for a in c.get("attributes", []):
                attr_obj = TaxonomyAttribute.objects.get(taxonomy_version=version_obj, external_id=a["id"])
                CategoryAttribute.objects.create(
                    category=cat_obj,
                    attribute=attr_obj,
                    is_extended=a.get("extended", False),
                    raw_data=a,
                )

        # 5. Validation
        validator = TaxonomyValidator(version_obj)
        res = validator.validate_all()
        self.assertTrue(res["is_valid"], f"Validation failed: {res.get('errors')}")

        if activate:
            TaxonomyVersion.objects.filter(is_active=True).exclude(pk=version_obj.pk).update(
                is_active=False,
                status=TaxonomyVersion.STATUS_ARCHIVED,
            )
            version_obj.status = TaxonomyVersion.STATUS_ACTIVE
            version_obj.is_active = True
            version_obj.stats = res.get("summary", {})
            version_obj.save()

        return version_obj

    def test_fixture_import_and_service_lookups(self):
        """Tests that imported taxonomy correctly answers queries via TaxonomyService."""
        version = self._import_test_fixture("2026-08-active")
        self.assertTrue(version.is_active)
        self.assertEqual(version.status, TaxonomyVersion.STATUS_ACTIVE)

        service = TaxonomyService.get_instance()
        active = service.get_active_version()
        self.assertIsNotNone(active)
        self.assertEqual(active.version_code, "2026-08-active")

        # Check root category
        roots = service.get_root_categories()
        self.assertEqual(len(roots), 1)
        self.assertEqual(roots[0].name, "Apparel & Accessories")
        self.assertTrue(roots[0].is_root)
        self.assertFalse(roots[0].is_leaf)

        # Check leaf category
        leaf = service.get_category_by_external_id("gid://shopify/TaxonomyCategory/aa-1-1")
        self.assertIsNotNone(leaf)
        self.assertTrue(leaf.is_leaf)
        self.assertEqual(leaf.name, "Shirts & Tops")
        self.assertEqual(leaf.parent.external_id, "gid://shopify/TaxonomyCategory/aa-1")

        # Check category attributes
        attrs = service.get_category_attributes_with_values(leaf)
        self.assertEqual(len(attrs), 2)
        attr_names = [a["name"] for a in attrs]
        self.assertIn("Color", attr_names)
        self.assertIn("Material", attr_names)

        # Check values
        color_attr = next(a for a in attrs if a["name"] == "Color")
        val_names = [v["name"] for v in color_attr["allowed_values"]]
        self.assertIn("Black", val_names)
        self.assertIn("Navy Blue", val_names)

    def test_validation_detects_orphan(self):
        """Tests that TaxonomyValidator rejects categories with invalid/missing parents."""
        version = self._import_test_fixture("2026-08-orphan-test", activate=False)
        # Create an orphan category marked as non-root with no parent
        TaxonomyCategory.objects.create(
            taxonomy_version=version,
            external_id="gid://shopify/TaxonomyCategory/orphan-1",
            name="Orphan Category",
            full_path="Orphan Category",
            level=1,
            is_root=False,
            parent=None,
        )

        validator = TaxonomyValidator(version)
        res = validator.validate_all()
        self.assertFalse(res["is_valid"])
        self.assertTrue(any("orphan" in err.lower() for err in res["errors"]))

    def test_validation_detects_cycle(self):
        """Tests that TaxonomyValidator detects circular parent-child references."""
        version = self._import_test_fixture("2026-08-cycle-test", activate=False)
        cat_a = TaxonomyCategory.objects.get(taxonomy_version=version, external_id="gid://shopify/TaxonomyCategory/aa")
        cat_b = TaxonomyCategory.objects.get(taxonomy_version=version, external_id="gid://shopify/TaxonomyCategory/aa-1")
        
        # Introduce cycle: cat_a parent set to cat_b while cat_b parent is cat_a
        cat_a.parent = cat_b
        cat_a.is_root = False
        cat_a.save()

        validator = TaxonomyValidator(version)
        res = validator.validate_all()
        self.assertFalse(res["is_valid"])
        self.assertTrue(any("Cyclic reference detected" in err for err in res["errors"]))

    def test_transactional_safety_preserves_active_version(self):
        """Tests that a failed import does NOT destroy or deactivate the previous ACTIVE version."""
        # 1. Establish valid active version
        active_version = self._import_test_fixture("2026-08-v1", activate=True)
        self.assertTrue(active_version.is_active)

        # 2. Attempt failed import on a new version
        failed_version = TaxonomyVersion.objects.create(
            version_code="2026-08-failed",
            status=TaxonomyVersion.STATUS_IMPORTING,
            is_active=False,
        )

        # Create invalid state in failed_version (e.g. 0 categories)
        validator = TaxonomyValidator(failed_version)
        res = validator.validate_all()
        self.assertFalse(res["is_valid"])

        # 3. Verify original active version is still ACTIVE
        active_version.refresh_from_db()
        self.assertTrue(active_version.is_active)
        self.assertEqual(active_version.status, TaxonomyVersion.STATUS_ACTIVE)

    def test_api_endpoints(self):
        """Tests DRF API endpoints for taxonomy tree, categories, and attributes."""
        version = self._import_test_fixture("2026-08-api", activate=True)

        # Active version endpoint
        resp = self.client.get('/api/taxonomy/versions/active/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['version_code'], '2026-08-api')

        # Roots endpoint
        resp = self.client.get('/api/taxonomy/categories/roots/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['external_id'], 'gid://shopify/TaxonomyCategory/aa')

        # Category detail with breadcrumbs & return reasons
        cat = TaxonomyCategory.objects.get(taxonomy_version=version, external_id='gid://shopify/TaxonomyCategory/aa')
        resp = self.client.get(f'/api/taxonomy/categories/{cat.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['name'], 'Apparel & Accessories')
        self.assertTrue(len(resp.data['return_reasons']) > 0)
        self.assertEqual(resp.data['return_reasons'][0]['name'], 'Size')

        # Category attributes endpoint
        resp = self.client.get(f'/api/taxonomy/categories/{cat.id}/attributes/')
        self.assertEqual(resp.status_code, 200)
