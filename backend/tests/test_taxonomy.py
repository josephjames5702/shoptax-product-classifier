from django.test import TestCase
from apps.taxonomy.models import TaxonomyVersion, TaxonomyCategory, TaxonomyAttribute, TaxonomyAttributeValue, CategoryAttribute
from services.taxonomy_service import TaxonomyService

class TaxonomyServiceTestCase(TestCase):
    def setUp(self):
        self.version = TaxonomyVersion.objects.create(version_code='test-v1', name='Test Taxonomy', is_active=True, status='ACTIVE')
        self.parent = TaxonomyCategory.objects.create(
            taxonomy_version=self.version,
            external_id='gid://shopify/TaxonomyCategory/root-1',
            name='Furniture',
            full_path='Furniture',
            level=0,
            is_root=True,
            is_leaf=False
        )
        self.child = TaxonomyCategory.objects.create(
            taxonomy_version=self.version,
            external_id='gid://shopify/TaxonomyCategory/child-1',
            name='Sofas',
            full_path='Furniture > Sofas',
            parent=self.parent,
            level=1,
            is_root=False,
            is_leaf=True
        )
        self.attr = TaxonomyAttribute.objects.create(
            taxonomy_version=self.version,
            external_id='gid://shopify/TaxonomyAttribute/color',
            name='Color',
            handle='color'
        )
        self.val = TaxonomyAttributeValue.objects.create(
            attribute=self.attr,
            name='Midnight Blue',
            normalized_name='midnight blue'
        )
        CategoryAttribute.objects.create(
            category=self.child,
            attribute=self.attr,
            is_required=False
        )

    def test_taxonomy_hierarchy(self):
        service = TaxonomyService()
        cat = service.get_category_by_external_id('gid://shopify/TaxonomyCategory/child-1')
        self.assertIsNotNone(cat)
        self.assertEqual(cat.parent, self.parent)
        self.assertTrue(cat.is_leaf)

    def test_category_attributes_with_values(self):
        service = TaxonomyService()
        attrs = service.get_category_attributes_with_values(str(self.child.id))
        self.assertEqual(len(attrs), 1)
        self.assertEqual(attrs[0]['attribute_name'], 'Color')
        self.assertEqual(len(attrs[0]['allowed_values']), 1)
        self.assertEqual(attrs[0]['allowed_values'][0]['name'], 'Midnight Blue')
