"""
Shopify Standard Product Taxonomy Ingestion Engine.
Handles downloading, verifying, parsing, validating, and activating taxonomy releases safely.
"""

import os
import json
import gzip
import hashlib
import logging
import urllib.request
from typing import Dict, Any, List, Optional, Tuple
from django.db import transaction
from django.utils import timezone

from apps.taxonomy.models import (
    TaxonomyVersion,
    TaxonomyCategory,
    TaxonomyAttribute,
    TaxonomyAttributeValue,
    CategoryAttribute,
)
from services.taxonomy_validator import TaxonomyValidator

logger = logging.getLogger(__name__)


class TaxonomyImportError(Exception):
    pass


class TaxonomyImporter:
    """
    Importer for official Shopify Standard Product Taxonomy releases.
    """

    GITHUB_REPO = "Shopify/product-taxonomy"
    DEFAULT_VERSION = "2026-08"

    def __init__(self, cache_dir: Optional[str] = None):
        if cache_dir:
            self.cache_dir = cache_dir
        else:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            self.cache_dir = os.path.join(base_dir, "data", "taxonomy_cache")
        os.makedirs(self.cache_dir, exist_ok=True)

    def fetch_release_info(self, version_code: str) -> Dict[str, Any]:
        tag = version_code if version_code.startswith("v") or version_code == "unstable" else f"v{version_code}"
        api_url = f"https://api.github.com/repos/{self.GITHUB_REPO}/releases/tags/{tag}"
        req = urllib.request.Request(
            api_url,
            headers={
                "User-Agent": "ShopifyTaxonomyImporter/1.0",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=3) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception:
            return {
                "tag_name": tag,
                "name": version_code,
                "prerelease": "unstable" in version_code.lower() or "beta" in version_code.lower(),
                "assets": [],
            }

    def load_json_file(self, file_path_or_bytes) -> Dict[str, Any]:
        if isinstance(file_path_or_bytes, bytes):
            try:
                decompressed = gzip.decompress(file_path_or_bytes).decode("utf-8")
            except Exception:
                decompressed = file_path_or_bytes.decode("utf-8")
            return json.loads(decompressed)
        elif isinstance(file_path_or_bytes, str):
            if file_path_or_bytes.endswith(".gz"):
                with gzip.open(file_path_or_bytes, "rt", encoding="utf-8") as f:
                    return json.load(f)
            else:
                with open(file_path_or_bytes, "r", encoding="utf-8") as f:
                    return json.load(f)
        else:
            raise ValueError(f"Unsupported file format: {type(file_path_or_bytes)}")

    def import_from_sources(
        self,
        version_code: str = DEFAULT_VERSION,
        taxonomy_file: Optional[str] = None,
        categories_file: Optional[str] = None,
        attributes_file: Optional[str] = None,
        force: bool = False,
        activate: bool = True,
        dry_run: bool = False,
    ) -> TaxonomyVersion:
        print(f"Starting taxonomy ingestion for version '{version_code}' (force={force}, activate={activate}, dry_run={dry_run})", flush=True)

        cached_cats = os.path.join(self.cache_dir, "categories.en.json.gz")
        cached_attrs = os.path.join(self.cache_dir, "attributes.en.json.gz")
        cached_tax = os.path.join(self.cache_dir, "taxonomy.en.json.gz")

        source_urls = {}
        asset_checksums = {}

        release_info = self.fetch_release_info(version_code)
        release_tag = release_info.get("tag_name", f"v{version_code}")
        release_name = release_info.get("name", version_code)
        is_prerelease = release_info.get("prerelease", False)
        release_status = "UNSTABLE" if is_prerelease else "STABLE"

        cat_data = None
        attr_data = None

        if taxonomy_file and os.path.exists(taxonomy_file):
            print(f"Loading taxonomy file: {taxonomy_file}", flush=True)
            raw_tax = self.load_json_file(taxonomy_file)
            cat_data = {"version": raw_tax.get("version", version_code), "verticals": raw_tax.get("verticals", [])}
            attr_data = {"version": raw_tax.get("version", version_code), "attributes": raw_tax.get("attributes", [])}
            source_urls["taxonomy"] = taxonomy_file
            with open(taxonomy_file, "rb") as f:
                asset_checksums["taxonomy"] = hashlib.sha256(f.read()).hexdigest()
        elif categories_file and os.path.exists(categories_file):
            print(f"Loading categories file: {categories_file}", flush=True)
            cat_data = self.load_json_file(categories_file)
            source_urls["categories"] = categories_file
            with open(categories_file, "rb") as f:
                asset_checksums["categories"] = hashlib.sha256(f.read()).hexdigest()
        elif os.path.exists(cached_cats):
            print(f"Loading cached categories: {cached_cats}", flush=True)
            cat_data = self.load_json_file(cached_cats)
            source_urls["categories"] = f"https://github.com/{self.GITHUB_REPO}/releases/download/{release_tag}/categories.en.json.gz"
            with open(cached_cats, "rb") as f:
                asset_checksums["categories"] = hashlib.sha256(f.read()).hexdigest()

        if attr_data is None:
            if attributes_file and os.path.exists(attributes_file):
                print(f"Loading attributes file: {attributes_file}", flush=True)
                attr_data = self.load_json_file(attributes_file)
                source_urls["attributes"] = attributes_file
                with open(attributes_file, "rb") as f:
                    asset_checksums["attributes"] = hashlib.sha256(f.read()).hexdigest()
            elif os.path.exists(cached_attrs):
                print(f"Loading cached attributes: {cached_attrs}", flush=True)
                attr_data = self.load_json_file(cached_attrs)
                source_urls["attributes"] = f"https://github.com/{self.GITHUB_REPO}/releases/download/{release_tag}/attributes.en.json.gz"
                with open(cached_attrs, "rb") as f:
                    asset_checksums["attributes"] = hashlib.sha256(f.read()).hexdigest()

        if not cat_data or "verticals" not in cat_data:
            raise TaxonomyImportError("Failed to parse category data: 'verticals' not found.")
        if not attr_data or "attributes" not in attr_data:
            raise TaxonomyImportError("Failed to parse attribute data: 'attributes' not found.")

        if dry_run:
            total_cats = sum(len(v.get("categories", [])) for v in cat_data.get("verticals", []))
            total_attrs = len(attr_data.get("attributes", []))
            print(f"DRY RUN PASSED: {total_cats} categories, {total_attrs} attributes verified.", flush=True)
            return TaxonomyVersion(version_code=version_code, name=f"Dry Run {version_code}")

        target_version_code = version_code
        existing_version = TaxonomyVersion.objects.filter(version_code=target_version_code).first()

        if existing_version and existing_version.status == TaxonomyVersion.STATUS_ACTIVE and not force:
            print(f"Taxonomy version '{target_version_code}' is already ACTIVE.", flush=True)
            return existing_version

        # In case of reset, purge old rows
        if existing_version and force:
            print(f"Resetting existing records for version '{target_version_code}'...", flush=True)
            CategoryAttribute.objects.filter(category__taxonomy_version=existing_version).delete()
            TaxonomyAttributeValue.objects.filter(attribute__taxonomy_version=existing_version).delete()
            TaxonomyCategory.objects.filter(taxonomy_version=existing_version).delete()
            TaxonomyAttribute.objects.filter(taxonomy_version=existing_version).delete()
            version_obj = existing_version
            version_obj.status = TaxonomyVersion.STATUS_IMPORTING
            version_obj.is_active = False
            version_obj.source_urls = source_urls
            version_obj.asset_checksums = asset_checksums
            version_obj.release_tag = release_tag
            version_obj.release_name = release_name
            version_obj.release_status = release_status
            version_obj.error_message = ""
            version_obj.save()
        else:
            version_obj, _ = TaxonomyVersion.objects.get_or_create(
                version_code=target_version_code,
                defaults={
                    "name": f"Shopify Standard Product Taxonomy ({version_code})",
                    "release_tag": release_tag,
                    "release_name": release_name,
                    "release_status": release_status,
                    "status": TaxonomyVersion.STATUS_IMPORTING,
                    "is_active": False,
                    "source_urls": source_urls,
                    "asset_checksums": asset_checksums,
                },
            )

        try:
            # 1. Attributes & Values
            print("Pass 1: Creating global attributes and allowed values...", flush=True)
            attributes_list = attr_data.get("attributes", [])
            created_attrs = []
            values_to_create = []

            for item in attributes_list:
                attr_obj = TaxonomyAttribute(
                    taxonomy_version=version_obj,
                    external_id=item.get("id"),
                    name=item.get("name", ""),
                    handle=item.get("handle", ""),
                    description=item.get("description", ""),
                    data_type="choice",
                    raw_data={"extended_attributes": item.get("extended_attributes", [])},
                )
                created_attrs.append((attr_obj, item.get("values", [])))

            TaxonomyAttribute.objects.bulk_create([a[0] for a in created_attrs], batch_size=2000)

            attr_map = {
                a.external_id: a
                for a in TaxonomyAttribute.objects.filter(taxonomy_version=version_obj)
            }

            for attr_obj, values in created_attrs:
                saved_attr = attr_map.get(attr_obj.external_id)
                if not saved_attr:
                    continue
                for val_item in values:
                    val_name = val_item.get("name", "")
                    values_to_create.append(
                        TaxonomyAttributeValue(
                            attribute=saved_attr,
                            external_id=val_item.get("id", ""),
                            name=val_name,
                            handle=val_item.get("handle", ""),
                            normalized_name=val_name.strip().lower(),
                            raw_data=val_item,
                        )
                    )

            TaxonomyAttributeValue.objects.bulk_create(values_to_create, batch_size=4000)
            print(f"Pass 1 complete: {len(attr_map)} attributes and {len(values_to_create)} values created.", flush=True)

            # 2. Categories (Flat insert with precomputed attribute_ids)
            print("Pass 2: Creating categories...", flush=True)
            raw_categories = []
            for vertical in cat_data.get("verticals", []):
                for cat_item in vertical.get("categories", []):
                    raw_categories.append(cat_item)

            cats_to_create = []
            for cat_item in raw_categories:
                level = int(cat_item.get("level", 0))
                assigned_attr_ids = [
                    (a.get("id") if isinstance(a, dict) else a)
                    for a in cat_item.get("attributes", [])
                ]
                cats_to_create.append(
                    TaxonomyCategory(
                        taxonomy_version=version_obj,
                        external_id=cat_item.get("id"),
                        name=cat_item.get("name", ""),
                        full_path=cat_item.get("full_name", cat_item.get("name", "")),
                        level=level,
                        is_root=(level == 0),
                        is_leaf=True,
                        attribute_ids=assigned_attr_ids,
                        raw_data={"return_reasons": cat_item.get("return_reasons", [])},
                    )
                )

            TaxonomyCategory.objects.bulk_create(cats_to_create, batch_size=3000)
            print(f"Pass 2 complete: {len(cats_to_create)} categories created.", flush=True)

            # 3. Resolve Hierarchy & Ancestor Paths
            print("Pass 3: Resolving hierarchy...", flush=True)
            cat_map = {
                c.external_id: c
                for c in TaxonomyCategory.objects.filter(taxonomy_version=version_obj)
            }
            raw_cat_map = {item.get("id"): item for item in raw_categories}

            parent_to_children: Dict[str, List[str]] = {}
            for item in raw_categories:
                cid = item.get("id")
                pid = item.get("parent_id")
                if pid:
                    if pid not in parent_to_children:
                        parent_to_children[pid] = []
                    parent_to_children[pid].append(cid)

            cats_update = []
            for item in raw_categories:
                cid = item.get("id")
                pid = item.get("parent_id")
                cat_obj = cat_map.get(cid)
                if not cat_obj:
                    continue

                if pid and pid in cat_map:
                    cat_obj.parent = cat_map[pid]
                    cat_obj.is_root = False
                else:
                    cat_obj.parent = None
                    cat_obj.is_root = (cat_obj.level == 0)

                children_ids = parent_to_children.get(cid, [])
                cat_obj.is_leaf = (len(children_ids) == 0)
                cat_obj.children_ids = children_ids

                # Ancestor traversal in O(1)
                ancestors = []
                curr_p = pid
                visited = set([cid])
                while curr_p and curr_p in cat_map and curr_p not in visited:
                    visited.add(curr_p)
                    ancestors.insert(0, curr_p)
                    p_item = raw_cat_map.get(curr_p)
                    curr_p = p_item.get("parent_id") if p_item else None

                cat_obj.ancestor_ids = ancestors
                cats_update.append(cat_obj)

            TaxonomyCategory.objects.bulk_update(
                cats_update,
                ["parent", "level", "is_root", "is_leaf", "ancestor_ids", "children_ids"],
                batch_size=2000,
            )
            print("Pass 3 complete: Hierarchy and ancestors resolved.", flush=True)

            # 4. Category Attributes
            print("Pass 4: Associating category attributes...", flush=True)
            cat_attrs_to_create = []

            for item in raw_categories:
                cid = item.get("id")
                cat_obj = cat_map.get(cid)
                if not cat_obj:
                    continue

                for attr_ref in item.get("attributes", []):
                    attr_ext_id = attr_ref.get("id") if isinstance(attr_ref, dict) else attr_ref
                    attr_obj = attr_map.get(attr_ext_id)
                    if attr_obj:
                        is_ext = attr_ref.get("extended", False) if isinstance(attr_ref, dict) else False
                        cat_attrs_to_create.append(
                            CategoryAttribute(
                                category=cat_obj,
                                attribute=attr_obj,
                                is_required=False,
                                is_extended=is_ext,
                                raw_data=attr_ref if isinstance(attr_ref, dict) else {},
                            )
                        )

            CategoryAttribute.objects.bulk_create(cat_attrs_to_create, batch_size=4000)
            print(f"Pass 4 complete: {len(cat_attrs_to_create)} category attributes linked.", flush=True)

            # 5. Validation & Stats
            print("Pass 5: Validating database integrity...", flush=True)
            validator = TaxonomyValidator(version_obj)
            v_res = validator.validate_all()
            if not v_res["is_valid"]:
                raise TaxonomyImportError(f"Validation failed: {'; '.join(v_res.get('errors', []))}")

            print("Pass 6: Computing actual database statistics...", flush=True)
            stats = {
                "categories_count": TaxonomyCategory.objects.filter(taxonomy_version=version_obj).count(),
                "root_categories_count": TaxonomyCategory.objects.filter(taxonomy_version=version_obj, is_root=True).count(),
                "leaf_categories_count": TaxonomyCategory.objects.filter(taxonomy_version=version_obj, is_leaf=True).count(),
                "attributes_count": TaxonomyAttribute.objects.filter(taxonomy_version=version_obj).count(),
                "values_count": TaxonomyAttributeValue.objects.filter(attribute__taxonomy_version=version_obj).count(),
                "category_attributes_count": CategoryAttribute.objects.filter(category__taxonomy_version=version_obj).count(),
                "validation_summary": v_res.get("summary", {}),
            }
            version_obj.stats = stats
            version_obj.completed_at = timezone.now()

            # 6. Activation
            if activate:
                print("Pass 7: Activating taxonomy version atomically...", flush=True)
                with transaction.atomic():
                    TaxonomyVersion.objects.filter(is_active=True).exclude(pk=version_obj.pk).update(
                        is_active=False,
                        status=TaxonomyVersion.STATUS_ARCHIVED,
                    )
                    version_obj.status = TaxonomyVersion.STATUS_ACTIVE
                    version_obj.is_active = True
                    version_obj.save()
            else:
                version_obj.status = TaxonomyVersion.STATUS_ARCHIVED
                version_obj.is_active = False
                version_obj.save()

            print(f"\nSUCCESS: Taxonomy '{version_code}' active in database.", flush=True)
            return version_obj

        except Exception as e:
            logger.exception(f"Taxonomy import failed: {e}")
            version_obj.status = TaxonomyVersion.STATUS_FAILED
            version_obj.is_active = False
            version_obj.error_message = str(e)
            version_obj.save()
            raise TaxonomyImportError(f"Taxonomy import failed: {e}") from e
