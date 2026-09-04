"""
Django management command to import the official Shopify Standard Product Taxonomy.
"""

import time
import json
from django.core.management.base import BaseCommand, CommandError
from services.taxonomy_importer import TaxonomyImporter, TaxonomyImportError


class Command(BaseCommand):
    help = "Imports and verifies the official Shopify Standard Product Taxonomy distribution."

    def add_arguments(self, parser):
        parser.add_argument(
            "--taxonomy-version",
            type=str,
            default="2026-08",
            help="Taxonomy version code (e.g., 2026-08, v2026-08, unstable). Default is 2026-08.",
        )
        parser.add_argument(
            "--taxonomy-file",
            type=str,
            default=None,
            help="Path to local taxonomy.en.json.gz (or .json) file containing both verticals and attributes.",
        )
        parser.add_argument(
            "--categories-file",
            type=str,
            default=None,
            help="Path to local categories.en.json.gz (or .json) file.",
        )
        parser.add_argument(
            "--attributes-file",
            type=str,
            default=None,
            help="Path to local attributes.en.json.gz (or .json) file.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force re-import even if the taxonomy version is already imported.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and validate source assets without writing to database.",
        )
        parser.add_argument(
            "--no-activate",
            action="store_true",
            help="Import records without marking this version as ACTIVE.",
        )

    def handle(self, *args, **options):
        version_code = options["taxonomy_version"]
        taxonomy_file = options["taxonomy_file"]
        categories_file = options["categories_file"]
        attributes_file = options["attributes_file"]
        force = options["force"]
        dry_run = options["dry_run"]
        activate = not options["no_activate"]

        self.stdout.write(self.style.MIGRATE_HEADING(f"=== Shopify Taxonomy Ingestion: Version {version_code} ==="))
        start_time = time.time()

        importer = TaxonomyImporter()

        try:
            version_obj = importer.import_from_sources(
                version_code=version_code,
                taxonomy_file=taxonomy_file,
                categories_file=categories_file,
                attributes_file=attributes_file,
                force=force,
                activate=activate,
                dry_run=dry_run,
            )

            duration = time.time() - start_time

            if dry_run:
                self.stdout.write(self.style.SUCCESS(f"Dry run parse completed successfully in {duration:.2f}s."))
                return

            self.stdout.write(self.style.SUCCESS(f"\n[OK] Taxonomy Version '{version_code}' imported successfully in {duration:.2f}s!"))
            self.stdout.write(self.style.MIGRATE_LABEL(f"Status: {version_obj.status} (Active: {version_obj.is_active})"))
            self.stdout.write(self.style.MIGRATE_LABEL(f"Release Tag: {version_obj.release_tag} ({version_obj.release_status})"))
            
            if version_obj.asset_checksums:
                self.stdout.write("\nAsset Checksums (SHA-256):")
                for asset_name, sha in version_obj.asset_checksums.items():
                    self.stdout.write(f"  - {asset_name}: {sha}")

            if version_obj.stats:
                self.stdout.write("\nImported Statistics:")
                self.stdout.write(f"  - Total Categories: {version_obj.stats.get('categories_count', 0)}")
                self.stdout.write(f"  - Root Verticals: {version_obj.stats.get('root_categories_count', 0)}")
                self.stdout.write(f"  - Leaf Categories: {version_obj.stats.get('leaf_categories_count', 0)}")
                self.stdout.write(f"  - Global Attributes: {version_obj.stats.get('attributes_count', 0)}")
                self.stdout.write(f"  - Attribute Values: {version_obj.stats.get('values_count', 0)}")
                self.stdout.write(f"  - Category-Attribute Links: {version_obj.stats.get('category_attributes_count', 0)}")

        except TaxonomyImportError as e:
            self.stderr.write(self.style.ERROR(f"Taxonomy Import Error: {e}"))
            raise CommandError(str(e))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Unexpected Error during taxonomy import: {e}"))
            raise CommandError(str(e))
