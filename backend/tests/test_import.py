import os
import tempfile
import csv
from django.test import TestCase
from services.import_service import ImportService
from services.classification_service import ClassificationService
from apps.products.models import Product

class ImportServiceTestCase(TestCase):
    def test_csv_import_and_data_leakage_isolation(self):
        # Create a sample CSV with leak columns
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'Product Number', 'Product Name', 'Product Description', 'Brand',
                'Product Category', 'Product Sub Category', 'Materials', 'Product Color', 'Image 1'
            ])
            writer.writerow([
                'SKU-TEST-101', 'Tufted Velvet Sectional Sofa', 'Luxury modern living room velvet sectional',
                'Modway', 'Living Room Furniture', 'Couches', 'Velvet, Wood', 'Emerald Green', 'https://example.com/img1.jpg'
            ])
            temp_path = f.name

        try:
            importer = ImportService(catalog_name='Test Catalog', file_path=temp_path, original_filename='test.csv')
            catalog = importer.parse_and_create()

            self.assertEqual(catalog.total_products, 1)
            self.assertEqual(catalog.summary_stats['with_images'], 1)

            product = Product.objects.get(catalog=catalog, product_number='SKU-TEST-101')
            self.assertEqual(product.title, 'Tufted Velvet Sectional Sofa')
            self.assertEqual(product.brand, 'Modway')
            self.assertEqual(product.materials, 'Velvet, Wood')
            self.assertEqual(product.color, 'Emerald Green')

            # CRITICAL LEAKAGE TEST:
            # Check raw_data has the reference fields
            self.assertIn('Product Category', product.raw_data)
            self.assertEqual(product.raw_data['Product Category'], 'Living Room Furniture')

            # Test canonical query text builder strictly NEVER contains leak words from those columns
            classification_service = ClassificationService()
            canonical_query = classification_service.build_canonical_text(product)
            
            # The canonical query should NOT format 'Product Category: Living Room Furniture'
            self.assertNotIn('Living Room Furniture', canonical_query)
            self.assertNotIn('Couches', canonical_query)
            self.assertIn('Tufted Velvet Sectional Sofa', canonical_query)
            self.assertIn('Modway', canonical_query)

        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
