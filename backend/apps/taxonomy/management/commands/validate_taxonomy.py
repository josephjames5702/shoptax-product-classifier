"""
Django management command to validate the integrity of a stored Shopify Taxonomy version.
"""

from django.core.management.base import BaseCommand, CommandError
from apps.taxonomy.models import TaxonomyVersion
from services.taxonomy_validator import TaxonomyValidator


class Command(BaseCommand):
    help = "Validates the relational and structural integrity of an imported TaxonomyVersion."

    def add_arguments(self, parser):
        parser.add_argument(
            "--taxonomy-version",
            type=str,
            default=None,
            help="Taxonomy version code to validate (e.g. 2026-08). Defaults to the currently ACTIVE version.",
        )

    def handle(self, *args, **options):
        version_code = options["taxonomy_version"]
        if version_code:
            version_obj = TaxonomyVersion.objects.filter(version_code=version_code).first()
            if not version_obj:
                raise CommandError(f"Taxonomy version '{version_code}' not found in database.")
        else:
            version_obj = TaxonomyVersion.objects.filter(is_active=True).first()
            if not version_obj:
                raise CommandError("No ACTIVE taxonomy version found in database. Specify --version.")

        self.stdout.write(self.style.MIGRATE_HEADING(f"=== Validating Taxonomy Version: {version_obj.version_code} ==="))
        validator = TaxonomyValidator(version_obj)
        result = validator.validate_all()

        summary = result.get("summary", {})
        self.stdout.write("\nTaxonomy Summary:")
        self.stdout.write(f"  - Categories: {summary.get('categories_count', 0)}")
        self.stdout.write(f"  - Roots (Level 0): {summary.get('root_categories_count', 0)}")
        self.stdout.write(f"  - Leaves: {summary.get('leaf_categories_count', 0)}")
        self.stdout.write(f"  - Global Attributes: {summary.get('attributes_count', 0)}")
        self.stdout.write(f"  - Attribute Values: {summary.get('values_count', 0)}")
        self.stdout.write(f"  - Category-Attribute Links: {summary.get('category_attributes_count', 0)}")

        if result.get("warnings"):
            self.stdout.write(self.style.WARNING(f"\nWarnings ({len(result['warnings'])}):"))
            for w in result["warnings"]:
                self.stdout.write(self.style.WARNING(f"  [WARN] {w}"))

        if not result["is_valid"]:
            self.stderr.write(self.style.ERROR(f"\n[FAILED] Validation Errors ({len(result['errors'])}):"))
            for err in result["errors"]:
                self.stderr.write(self.style.ERROR(f"  [ERR] {err}"))
            raise CommandError("Taxonomy validation failed.")

        self.stdout.write(self.style.SUCCESS("\n[PASSED] All taxonomy integrity checks passed!"))
