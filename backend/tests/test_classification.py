from django.test import TestCase
from apps.catalogs.models import Catalog
from apps.products.models import Product, ProductImage
from apps.taxonomy.models import TaxonomyVersion, TaxonomyCategory, TaxonomyAttribute, TaxonomyAttributeValue, CategoryAttribute
from services.classification_service import ClassificationService
from apps.classification.models import ClassificationResult

class ClassificationPipelineTestCase(TestCase):
    def setUp(self):
        self.version = TaxonomyVersion.objects.create(version_code='test-v2', name='Shopify Taxonomy v2', is_active=True, status='ACTIVE')
        self.root_cat = TaxonomyCategory.objects.create(
            taxonomy_version=self.version,
            external_id='gid://shopify/TaxonomyCategory/home',
            name='Home & Garden',
            full_path='Home & Garden',
            level=0,
            is_root=True,
            is_leaf=False
        )
        self.sofa_cat = TaxonomyCategory.objects.create(
            taxonomy_version=self.version,
            external_id='gid://shopify/TaxonomyCategory/sofas',
            name='Sofas',
            full_path='Home & Garden > Furniture > Sofas',
            parent=self.root_cat,
            level=2,
            is_root=False,
            is_leaf=True
        )
        self.alt_cat = TaxonomyCategory.objects.create(
            taxonomy_version=self.version,
            external_id='gid://shopify/TaxonomyCategory/chairs',
            name='Chairs & Armchairs',
            full_path='Home & Garden > Furniture > Chairs & Armchairs',
            parent=self.root_cat,
            level=2,
            is_root=False,
            is_leaf=True
        )

        # Attribute
        self.color_attr = TaxonomyAttribute.objects.create(
            taxonomy_version=self.version,
            external_id='gid://shopify/TaxonomyAttribute/col',
            name='Color',
            handle='color'
        )
        self.color_val = TaxonomyAttributeValue.objects.create(
            attribute=self.color_attr,
            name='White',
            normalized_name='white'
        )
        CategoryAttribute.objects.create(
            category=self.sofa_cat,
            attribute=self.color_attr,
            is_required=False
        )

        self.catalog = Catalog.objects.create(name='Test Catalog', file_name='test.xlsx')
        self.product = Product.objects.create(
            catalog=self.catalog,
            product_number='EEI-1010-WHI',
            title='Empress Bonded Leather Sofa by Modway',
            description='Modern Sofa with tufted buttons and solid wooden legs',
            bullets='Bonded leather | Solid wooden legs | White finish',
            brand='Modway',
            product_type='Sofa',
            materials='Bonded Leather, Wood',
            color='White',
        )

    def test_end_to_end_product_classification(self):
        classifier = ClassificationService()
        result = classifier.classify_product(self.product)

        self.assertIsNotNone(result)
        self.assertEqual(result.product, self.product)
        self.assertIn('Sofa', result.category.name)
        self.assertGreater(result.confidence_score, 0)
        self.assertIn(result.confidence_level, [
            ClassificationResult.ConfidenceLevel.HIGH,
            ClassificationResult.ConfidenceLevel.MEDIUM,
            ClassificationResult.ConfidenceLevel.LOW
        ])

        # Verify extracted attribute
        extracted = result.extracted_attributes.filter(attribute__name='Color').first()
        if extracted:
            self.assertEqual(extracted.normalized_value, 'White')
            self.assertTrue(extracted.is_valid_taxonomy_value)
