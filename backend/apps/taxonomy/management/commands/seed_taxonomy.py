"""
Seed Shopify Standard Product Taxonomy from downloaded JSON assets into database.
"""

import os
import json
import logging
from django.core.management.base import BaseCommand
from django.db import transaction
from django.conf import settings
from apps.taxonomy.models import (
    TaxonomyVersion,
    TaxonomyCategory,
    TaxonomyAttribute,
    TaxonomyAttributeValue,
    CategoryAttribute,
)

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Seeds the Shopify Standard Product Taxonomy into the local database.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Forces re-import even if version already exists',
        )

    def handle(self, *args, **options):
        force = options.get('force', False)
        base_dir = settings.BASE_DIR
        categories_file = os.path.join(base_dir, 'data', 'taxonomy', 'categories.en.json')
        attributes_file = os.path.join(base_dir, 'data', 'taxonomy', 'attributes.en.json')

        if not os.path.exists(categories_file) or not os.path.exists(attributes_file):
            self.stdout.write(self.style.ERROR(f"Taxonomy files not found at {categories_file}. Please ensure files are present."))
            return

        self.stdout.write("Loading taxonomy JSON files...")
        with open(categories_file, 'r', encoding='utf-8') as f:
            cat_data = json.load(f)
        with open(attributes_file, 'r', encoding='utf-8') as f:
            attr_data = json.load(f)

        version_code = cat_data.get('version', '2026-08')
        
        tax_version, created = TaxonomyVersion.objects.get_or_create(
            version_code=version_code,
            defaults={'name': f"Shopify Standard Product Taxonomy ({version_code})", 'is_active': True}
        )

        if not created and not force:
            existing_cats = TaxonomyCategory.objects.filter(taxonomy_version=tax_version).count()
            if existing_cats > 0:
                self.stdout.write(self.style.SUCCESS(f"Taxonomy v{version_code} already imported with {existing_cats} categories."))
                return

        self.stdout.write(f"Importing Shopify Taxonomy v{version_code}...")

        # 1. Ingest Attributes & Attribute Values
        raw_attributes = attr_data.get('attributes', [])
        self.stdout.write(f"Processing {len(raw_attributes)} attributes...")

        # Clean existing attributes for this version if force
        if force:
            TaxonomyCategory.objects.filter(taxonomy_version=tax_version).delete()
            TaxonomyAttribute.objects.filter(taxonomy_version=tax_version).delete()

        attr_objs = []
        for a in raw_attributes:
            ext_id = a.get('id', '')
            name = a.get('name', '')
            handle = a.get('handle', '')
            desc = a.get('description', '')
            attr_objs.append(
                TaxonomyAttribute(
                    taxonomy_version=tax_version,
                    external_id=ext_id,
                    name=name,
                    handle=handle,
                    description=desc or '',
                    data_type='choice'
                )
            )

        with transaction.atomic():
            TaxonomyAttribute.objects.bulk_create(attr_objs, batch_size=1000, ignore_conflicts=True)

        # Map external_id -> TaxonomyAttribute model instance
        attr_map = {attr.external_id: attr for attr in TaxonomyAttribute.objects.filter(taxonomy_version=tax_version)}

        # Ingest Attribute Values
        value_objs = []
        for a in raw_attributes:
            ext_id = a.get('id', '')
            attr_instance = attr_map.get(ext_id)
            if not attr_instance:
                continue

            for v in a.get('values', []):
                val_id = v.get('id', '')
                val_name = v.get('name', '')
                if val_name:
                    value_objs.append(
                        TaxonomyAttributeValue(
                            attribute=attr_instance,
                            external_id=val_id,
                            name=val_name,
                            normalized_name=val_name.strip().lower()
                        )
                    )

        self.stdout.write(f"Inserting {len(value_objs)} attribute values...")
        with transaction.atomic():
            TaxonomyAttributeValue.objects.bulk_create(value_objs, batch_size=2000, ignore_conflicts=True)

        # 2. Ingest Categories
        verticals = cat_data.get('verticals', [])
        all_raw_categories = []
        for v in verticals:
            all_raw_categories.extend(v.get('categories', []))

        self.stdout.write(f"Processing {len(all_raw_categories)} categories across {len(verticals)} verticals...")

        cat_instances = []
        for c in all_raw_categories:
            ext_id = c.get('id', '')
            name = c.get('name', '')
            full_name = c.get('full_name', '')
            level = c.get('level', 0)
            children = c.get('children', [])
            ancestors = [a.get('id') for a in c.get('ancestors', []) if isinstance(a, dict)]
            attrs = [a.get('id') for a in c.get('attributes', []) if isinstance(a, dict)]
            child_ids = [ch.get('id') for ch in children if isinstance(ch, dict)]

            cat_instances.append(
                TaxonomyCategory(
                    taxonomy_version=tax_version,
                    external_id=ext_id,
                    name=name,
                    full_path=full_name or name,
                    level=level,
                    is_leaf=(len(children) == 0),
                    is_root=(level == 0),
                    ancestor_ids=ancestors,
                    children_ids=child_ids,
                    attribute_ids=attrs
                )
            )

        with transaction.atomic():
            TaxonomyCategory.objects.bulk_create(cat_instances, batch_size=1000, ignore_conflicts=True)

        # 3. Update Parent relations and CategoryAttribute mappings
        self.stdout.write("Linking parent categories and category attributes...")
        created_cats_map = {c.external_id: c for c in TaxonomyCategory.objects.filter(taxonomy_version=tax_version)}

        cats_to_update = []
        category_attr_objs = []

        for c in all_raw_categories:
            ext_id = c.get('id', '')
            cat_obj = created_cats_map.get(ext_id)
            if not cat_obj:
                continue

            parent_id = c.get('parent_id')
            if parent_id and parent_id in created_cats_map:
                cat_obj.parent = created_cats_map[parent_id]
                cats_to_update.append(cat_obj)

            # Link category attributes
            for a in c.get('attributes', []):
                attr_ext_id = a.get('id') if isinstance(a, dict) else a
                if attr_ext_id in attr_map:
                    category_attr_objs.append(
                        CategoryAttribute(
                            category=cat_obj,
                            attribute=attr_map[attr_ext_id],
                            is_required=False
                        )
                    )

        if cats_to_update:
            with transaction.atomic():
                TaxonomyCategory.objects.bulk_update(cats_to_update, ['parent'], batch_size=1000)

        if category_attr_objs:
            with transaction.atomic():
                CategoryAttribute.objects.bulk_create(category_attr_objs, batch_size=2000, ignore_conflicts=True)

        self.stdout.write(self.style.SUCCESS(
            f"Successfully seeded Shopify Taxonomy v{version_code}:\n"
            f"- {len(cat_instances)} Categories\n"
            f"- {len(attr_objs)} Attributes\n"
            f"- {len(value_objs)} Attribute Values\n"
            f"- {len(category_attr_objs)} Category-Attribute Associations"
        ))
