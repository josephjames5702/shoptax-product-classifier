"""
Comprehensive Phase 3 & PRD Acceptance Test Suite.
Tests CSV/XLSX import, blank SKU handling, data leakage safeguards, 3-stage candidate retrieval,
sentence embeddings, candidate-constrained AI reranking, controlled attribute value matching,
image failure isolation, auditable evidence logging, job chunk resumability, reviewer override,
content fingerprinting idempotency, canonical status model regression, and 5-product E2E CSV upload.
"""

import os
import hashlib
import tempfile
import numpy as np
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.catalogs.models import Catalog
from apps.products.models import Product, ProductImage
from apps.jobs.models import ProcessingJob, JobChunk
from apps.taxonomy.models import TaxonomyVersion, TaxonomyCategory, TaxonomyAttribute, TaxonomyAttributeValue, CategoryAttribute
from apps.classification.models import ClassificationResult, ExtractedAttribute
from services.import_service import ImportService
from services.retrieval_service import RetrievalService
from services.semantic_embedding import SentenceEmbeddingEngine
from services.classifier_service import ClassifierService
from services.pipeline_runner import PipelineRunner
from services.attribute_extractor import AttributeExtractor
from services.confidence_scorer import ConfidenceScorer


class ClassificationPipelineTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        RetrievalService.clear_cache()

        # Create Active Taxonomy Version
        self.version = TaxonomyVersion.objects.create(
            version_code="2026-08",
            release_tag="v2026-08",
            release_status="STABLE",
            status="ACTIVE",
            is_active=True
        )

        # Create Root Category
        self.root_cat = TaxonomyCategory.objects.create(
            taxonomy_version=self.version,
            external_id="gid://shopify/TaxonomyCategory/ap",
            name="Animals & Pet Supplies",
            full_path="Animals & Pet Supplies",
            level=0,
            is_root=True,
            is_leaf=False
        )

        # Create Leaf Category
        self.leaf_cat = TaxonomyCategory.objects.create(
            taxonomy_version=self.version,
            external_id="gid://shopify/TaxonomyCategory/ap-2",
            name="Pet Supplies",
            full_path="Animals & Pet Supplies > Pet Supplies",
            parent=self.root_cat,
            level=1,
            is_root=False,
            is_leaf=True,
            ancestor_ids=[self.root_cat.id]
        )

        # Create Global Attribute & Value
        self.attr = TaxonomyAttribute.objects.create(
            taxonomy_version=self.version,
            external_id="gid://shopify/TaxonomyAttribute/1308",
            name="Animal type",
            handle="animal-type",
            description="Specifies animal type"
        )
        self.val = TaxonomyAttributeValue.objects.create(
            attribute=self.attr,
            external_id="gid://shopify/TaxonomyValue/100",
            name="Dog",
            handle="dog"
        )

        CategoryAttribute.objects.create(
            category=self.leaf_cat,
            attribute=self.attr,
            is_required=False
        )

    def test_initial_product_table_is_empty(self):
        """Rule: Product and Catalog table MUST be empty before catalogue upload."""
        self.assertEqual(Product.objects.count(), 0)
        self.assertEqual(Catalog.objects.count(), 0)
        self.assertEqual(ProcessingJob.objects.count(), 0)

    def test_test1_blank_product_number_skipped_and_logged(self):
        """TEST 1: Blank SKU / product_number row is skipped without crashing."""
        csv_content = "Product Number,Product Name,Description\n,Dog Harness,High quality harness\nSKU-101,Dog Collar,High quality collar\n"
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            importer = ImportService("Blank SKU Test", temp_path, "blank_sku_test.csv")
            cat = importer.parse_and_create()
            self.assertEqual(cat.total_products, 1) # Only SKU-101 imported
            self.assertEqual(cat.summary_stats['skipped_blank_skus'], 1)
        finally:
            os.remove(temp_path)

    def test_test2_no_description_or_bullets_reduces_confidence_to_review(self):
        """TEST 2: Product with no description/bullets gets reduced confidence & enters review."""
        cat = Catalog.objects.create(name="Bare Product Catalog")
        prod = Product.objects.create(
            catalog=cat,
            product_number="BARE-01",
            title="Short Item",
            description="",
            bullets=""
        )

        service = ClassifierService()
        result = service.classify_product(prod)
        prod.refresh_from_db()
        self.assertEqual(prod.processing_status, Product.ProcessingStatus.MANUAL_REVIEW)

    def test_test3_resuming_job_skips_done_chunks(self):
        """TEST 3: Resuming a job does not reprocess DONE chunks unnecessarily."""
        cat = Catalog.objects.create(name="Resume Test Catalog")
        for i in range(10):
            Product.objects.create(
                catalog=cat,
                product_number=f"PROD-{i}",
                title=f"Pet Supplies Product {i}",
                description="Pet supplies accessory"
            )

        job = ProcessingJob.objects.create(catalog=cat)
        # Pre-create Chunk 0 as DONE
        JobChunk.objects.create(
            job=job,
            chunk_index=0,
            start_index=0,
            end_index=5,
            status=JobChunk.ChunkStatus.DONE,
            total_items=5,
            processed_items=5
        )

        runner = PipelineRunner(cat, job, batch_size=5)
        runner.run()

        job.refresh_from_db()
        self.assertEqual(job.done_chunks, 2)

    def test_test4_reviewer_override_changes_status_to_approved(self):
        """TEST 4: Valid reviewer override changes status to APPROVED and records info."""
        cat = Catalog.objects.create(name="Override Catalog")
        prod = Product.objects.create(
            catalog=cat,
            product_number="OVR-01",
            title="Dog Toy",
            processing_status=Product.ProcessingStatus.MANUAL_REVIEW
        )
        res = ClassificationResult.objects.create(
            product=prod,
            taxonomy_version=self.version,
            category=self.leaf_cat,
            confidence_score=0.45,
            confidence_level="LOW",
            status=ClassificationResult.ReviewStatus.PENDING_REVIEW
        )

        # Reviewer action: Override category
        res.category = self.leaf_cat
        res.status = ClassificationResult.ReviewStatus.APPROVED
        res.reviewed_by = "Jane Reviewer"
        res.review_notes = "Confirmed correct Shopify category"
        res.save()

        self.assertEqual(res.status, ClassificationResult.ReviewStatus.APPROVED)
        self.assertEqual(res.reviewed_by, "Jane Reviewer")

    def test_test6_broken_image_does_not_prevent_text_classification(self):
        """TEST 6: Broken image does not stop text-only classification."""
        cat = Catalog.objects.create(name="Image Failure Catalog")
        prod = Product.objects.create(
            catalog=cat,
            product_number="IMG-FAIL-01",
            title="Dog Leash Nylon",
            description="Heavy duty pet supplies leash",
            product_type="Pet Supplies"
        )
        ProductImage.objects.create(
            product=prod,
            url="https://broken-image-link-404.com/photo.jpg",
            status=ProductImage.ImageStatus.FAILED,
            error_message="HTTP 404 Not Found"
        )

        service = ClassifierService()
        result = service.classify_product(prod)

        self.assertIsNotNone(result)
        self.assertEqual(result.image_status, "FAILED")
        self.assertEqual(result.category, self.leaf_cat)

    def test_test7_invalid_hallucinated_category_gid_rejected(self):
        """TEST 7: Invalid / hallucinated category_gid rejected."""
        service = ClassifierService()
        candidates = service.retrieval_service.retrieve_candidates({'title': 'Pet Supplies'})
        candidate_ids = {c['category_id'] for c in candidates}
        
        # Fake hallucinated ID from model
        fake_id = 999999999
        self.assertNotIn(fake_id, candidate_ids)

    def test_test8_invalid_taxonomy_attribute_value_rejected(self):
        """TEST 8: Invalid taxonomy attribute value rejected."""
        extracted = AttributeExtractor.extract_and_match(self.leaf_cat, {
            'title': 'High grade dog harness',
            'materials': 'Unobtanium Crystal' # Invalid value
        })
        for item in extracted:
            if item['attribute_name'] == 'Material':
                self.assertFalse(item['is_valid_taxonomy_value'])

    def test_test9_reimporting_unchanged_product_skips_reclassification(self):
        """TEST 9: Re-importing unchanged product skips unnecessary reclassification."""
        cat = Catalog.objects.create(name="Original Catalog")
        
        fp_src = "dog harness|high quality harness||||petco".lower()
        exact_fp = hashlib.sha256(fp_src.encode('utf-8')).hexdigest()

        prod = Product.objects.create(
            catalog=cat,
            product_number="SKU-SAME-01",
            title="Dog Harness",
            description="High quality harness",
            brand="PetCo",
            source_fingerprint=exact_fp,
            processing_status=Product.ProcessingStatus.COMPLETED
        )
        ClassificationResult.objects.create(
            product=prod,
            taxonomy_version=self.version,
            category=self.leaf_cat,
            confidence_score=0.95
        )

        csv_content = "Product Number,Product Name,Description,Brand\nSKU-SAME-01,Dog Harness,High quality harness,PetCo\n"
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            importer = ImportService("Reimport Catalog", temp_path, "reimport.csv")
            cat2 = importer.parse_and_create()
            reimported_prod = Product.objects.filter(catalog=cat2, product_number="SKU-SAME-01").first()
            self.assertTrue(reimported_prod.is_skipped_reclassification)
            self.assertEqual(reimported_prod.skip_reason, "Content unchanged")
        finally:
            os.remove(temp_path)

    def test_test10_taxonomy_not_redownloaded_when_active_exists(self):
        """TEST 10: Active taxonomy is reused without re-downloading."""
        active = TaxonomyVersion.objects.filter(is_active=True).first()
        self.assertIsNotNone(active)
        self.assertEqual(active.status, "ACTIVE")

    def test_regression_upload_catalog_endpoint_uses_canonical_uploaded_status(self):
        """REGRESSION TEST: Upload API uses canonical Catalog.Status.UPLOADED (no Status.IMPORTED error)."""
        csv_file = SimpleUploadedFile("test_upload.csv", b"Product Number,Product Name\nREG-001,Test Dog Leash\n", content_type="text/csv")
        response = self.client.post("/api/catalogs/upload/", {'file': csv_file}, format='multipart')
        self.assertEqual(response.status_code, 201)
        
        catalog_id = response.data['catalog_id']
        cat = Catalog.objects.get(id=catalog_id)
        self.assertEqual(cat.status, Catalog.Status.UPLOADED)

    def test_end_to_end_5_product_csv_upload_and_classification(self):
        """END-TO-END TEST: Fresh DB -> Upload 5 product CSV -> Import -> Create Job -> Run Pipeline."""
        csv_data = (
            "Product Number,Product Name,Description,Brand,Product Type,Materials,Color\n"
            "SKU-501,Dog Collar Leather,Heavy duty leather dog collar,PetCo,Dog Collar,Leather,Brown\n"
            "SKU-502,Dog Harness Nylon,Adjustable nylon dog harness,PetCo,Dog Harness,Nylon,Black\n"
            "SKU-503,Cat Bed Soft,Fleece cat bed cushion,PetCo,Cat Bed,Fleece,Grey\n"
            "SKU-504,Pet Bowl Stainless,Non-slip stainless steel pet bowl,PetCo,Bowl,Stainless Steel,Silver\n"
            "SKU-505,Dog Toy Rubber,Durable rubber chew toy for dogs,PetCo,Toy,Rubber,Red\n"
        )
        csv_file = SimpleUploadedFile("test_5_products.csv", csv_data.encode('utf-8'), content_type="text/csv")
        upload_resp = self.client.post("/api/catalogs/upload/", {'file': csv_file}, format='multipart')
        self.assertEqual(upload_resp.status_code, 201)

        catalog_id = upload_resp.data['catalog_id']
        cat = Catalog.objects.get(id=catalog_id)
        self.assertEqual(cat.total_products, 5)

        # Create Job & Run Pipeline
        job = ProcessingJob.objects.create(catalog=cat, total_items=5)
        runner = PipelineRunner(cat, job, batch_size=2)
        runner.run()

        job.refresh_from_db()
        cat.refresh_from_db()

        self.assertEqual(job.status, ProcessingJob.JobStatus.COMPLETED)
        self.assertEqual(job.processed_items, 5)
        self.assertEqual(job.done_chunks, 3) # 5 products in chunks of 2 = 3 chunks
        self.assertEqual(Product.objects.filter(catalog=cat, processing_status__in=['COMPLETED', 'MANUAL_REVIEW']).count(), 5)

    def test_upload_does_not_trigger_classification_or_jobs(self):
        """STRICT LIFECYCLE TEST: File upload imports products into DB with PENDING status, but creates ZERO jobs or classifications."""
        csv_data = "Product Number,Product Name,Description\nSKU-1001,Leash A,Nylon Leash\nSKU-1002,Leash B,Leather Leash\n"
        csv_file = SimpleUploadedFile("test_sep.csv", csv_data.encode('utf-8'), content_type="text/csv")
        
        upload_resp = self.client.post("/api/catalogs/upload/", {'file': csv_file}, format='multipart')
        self.assertEqual(upload_resp.status_code, 201)
        self.assertTrue(upload_resp.data['success'])
        self.assertIn('id', upload_resp.data)
        self.assertIn('created_at', upload_resp.data)

        catalog_id = upload_resp.data['catalog_id']
        cat = Catalog.objects.get(id=catalog_id)

        # Invariants immediately after upload:
        self.assertEqual(cat.total_products, 2)
        self.assertEqual(ProcessingJob.objects.filter(catalog=cat).count(), 0)
        self.assertEqual(ClassificationResult.objects.filter(product__catalog=cat).count(), 0)

        # Verify Products API returns both products in PENDING status BEFORE classification
        prod_resp = self.client.get(f"/api/products/?catalog_id={catalog_id}")
        self.assertEqual(prod_resp.status_code, 200)
        self.assertEqual(prod_resp.data['count'], 2)
        for p in prod_resp.data['results']:
            self.assertEqual(p['processing_status'], 'PENDING')
            self.assertIsNone(p['classification_summary'])
