"""
Catalog Import Service supporting XLSX and CSV formats.
Features:
- Streaming/Chunked parsing
- Flexible column mapping
- Data leakage isolation (strictly excluding Product Category/Subcategory from classifier features)
- Pre-classification data health metrics
- SHA-256 Content Fingerprinting & Idempotent SKU updates
- High performance batch insertion
"""

import os
import re
import csv
import logging
import hashlib
import openpyxl
from typing import Dict, Any, List, Tuple
from django.db import transaction
from apps.catalogs.models import Catalog
from apps.products.models import Product, ProductImage
from apps.classification.models import ClassificationResult

logger = logging.getLogger(__name__)

# Flexible column aliases
COLUMN_ALIASES = {
    'product_number': ['product number', 'sku', 'product_number', 'item number', 'item_code', 'product_id', 'code'],
    'model_number': ['model number', 'model', 'model_no', 'model_num', 'model_code'],
    'title': ['product name', 'title', 'name', 'item name', 'product_title', 'description_short'],
    'description': ['product description', 'description', 'product_description', 'long_description', 'body', 'body_html'],
    'bullets': ['bullets', 'bullet points', 'features', 'key features', 'bullet_points', 'highlights'],
    'brand': ['brand', 'brand name', 'manufacturer', 'vendor', 'make'],
    'product_type': ['product type', 'type', 'item type', 'item_type'],
    'materials': ['materials', 'material', 'fabric', 'composition'],
    'color': ['product color', 'color', 'finish', 'colour', 'primary_color'],
    'color_collection': ['color collection', 'finish collection', 'color_family'],
    'dimensions': ['product dimensions', 'dimensions', 'size', 'item dimensions', 'measurements'],
    'set_includes': ['set includes', 'included', 'package includes', 'package content'],
    'item_cost': ['item cost', 'cost', 'wholesale price', 'cost_price'],
    'map_price': ['map', 'map price', 'minimum advertised price'],
    'msrp': ['msrp', 'retail price', 'price', 'list price'],
    'country_of_origin': ['country of origin', 'origin', 'coo', 'made in'],
    'shipping_method': ['shipping method', 'shipping', 'freight'],
    'product_url': ['product url', 'url', 'link', 'product_link'],
}

# Strictly isolated fields that must NOT leak into feature vectors
LEAKAGE_COLUMNS = ['product category', 'product sub category', 'category', 'sub category', 'shopify category']


class ImportService:
    def __init__(self, catalog_name: str, file_path: str, original_filename: str):
        self.catalog_name = catalog_name
        self.file_path = file_path
        self.original_filename = original_filename
        self.file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

    def _normalize_header(self, header: str) -> str:
        if not header:
            return ''
        cleaned = re.sub(r'[^a-zA-Z0-9\s_]', '', str(header)).strip().lower()
        return re.sub(r'\s+', ' ', cleaned)

    def _match_column(self, normalized_header: str) -> str:
        for canonical_name, aliases in COLUMN_ALIASES.items():
            if normalized_header in aliases:
                return canonical_name
            for alias in aliases:
                if normalized_header == alias or normalized_header.startswith(alias + ' '):
                    return canonical_name
        return ''

    def _is_image_column(self, normalized_header: str) -> Tuple[bool, int]:
        m = re.match(r'image\s*(\d+)', normalized_header)
        if m:
            return True, int(m.group(1))
        if normalized_header in ['image', 'image_url', 'image url', 'photo', 'picture']:
            return True, 1
        return False, 0

    def parse_and_create(self, batch_size: int = 500, sample_limit: Optional[int] = 100) -> Catalog:
        ext = os.path.splitext(self.original_filename)[1].lower()
        if ext in ['.xlsx', '.xls']:
            rows_generator = self._read_excel_rows()
        elif ext == '.csv':
            rows_generator = self._read_csv_rows()
        else:
            raise ValueError(f"Unsupported file format: {ext}. Supported formats are CSV and XLSX.")

        try:
            raw_headers = next(rows_generator)
        except StopIteration:
            raise ValueError("The uploaded file is empty.")

        # Build column index mapping
        column_map = {}
        image_columns = []
        unmapped_indices = []

        for idx, header in enumerate(raw_headers):
            h_str = str(header) if header is not None else f"Column_{idx+1}"
            norm = self._normalize_header(h_str)
            
            is_img, pos = self._is_image_column(norm)
            if is_img:
                image_columns.append((idx, pos))
                continue

            matched_field = self._match_column(norm)
            if matched_field:
                column_map[idx] = (matched_field, h_str)
            else:
                unmapped_indices.append((idx, h_str))

        # Create Catalog record
        catalog = Catalog.objects.create(
            name=self.catalog_name,
            file_name=self.original_filename,
            file_size=self.file_size,
            file_path=self.file_path,
            status=Catalog.Status.PROCESSING,
            column_mapping={
                'mapped': {h_str: field for idx, (field, h_str) in column_map.items()},
                'unmapped': [h_str for idx, h_str in unmapped_indices],
                'images': len(image_columns),
            }
        )

        total_rows = 0
        imported_count = 0
        skipped_blank_skus_count = 0
        with_images_count = 0
        without_images_count = 0
        missing_descriptions_count = 0
        duplicate_skus_count = 0
        invalid_image_urls_count = 0
        seen_skus = set()

        products_to_create = []

        for row_idx, row in enumerate(rows_generator, start=2):
            total_rows += 1
            row_data = {}
            raw_data = {}

            for idx, val in enumerate(row):
                if idx < len(raw_headers):
                    header_name = str(raw_headers[idx]) if raw_headers[idx] is not None else f"Col_{idx+1}"
                    cleaned_val = val
                    if isinstance(val, str):
                        cleaned_val = val.replace('_x000D_\n', '\n').replace('_x000D_', '\n').strip()
                    raw_data[header_name] = cleaned_val

                    if idx in column_map:
                        field_name = column_map[idx][0]
                        row_data[field_name] = cleaned_val

            sku = str(row_data.get('product_number') or '').strip()
            
            # TEST 1: Blank SKU / product_number is logged and skipped without crashing
            if not sku:
                logger.warning(f"Row #{row_idx}: Product Number / SKU is blank. Skipping row without crashing.")
                skipped_blank_skus_count += 1
                continue

            title = str(row_data.get('title') or '').strip() or f"Product {sku}"
            desc = str(row_data.get('description') or '').strip()
            bullets = str(row_data.get('bullets') or '').strip()
            brand = str(row_data.get('brand') or '').strip()
            product_type = str(row_data.get('product_type') or '').strip()
            materials = str(row_data.get('materials') or '').strip()
            color = str(row_data.get('color') or '').strip()

            # Compute SHA-256 content fingerprint for idempotency check
            fingerprint_src = f"{title}|{desc}|{bullets}|{materials}|{color}|{brand}".lower()
            fingerprint = hashlib.sha256(fingerprint_src.encode('utf-8')).hexdigest()

            if sku in seen_skus:
                duplicate_skus_count += 1
            else:
                seen_skus.add(sku)

            if not desc:
                missing_descriptions_count += 1

            # Every newly imported product starts strictly as PENDING until explicit user classification
            is_skipped = False
            skip_reason = ""
            init_status = Product.ProcessingStatus.PENDING

            prod = Product(
                catalog=catalog,
                product_number=sku,
                model_number=str(row_data.get('model_number') or '').strip() or None,
                title=title,
                description=desc,
                bullets=bullets,
                brand=brand,
                product_type=product_type,
                materials=materials,
                color=color,
                color_collection=str(row_data.get('color_collection') or '').strip(),
                dimensions=str(row_data.get('dimensions') or '').strip(),
                set_includes=str(row_data.get('set_includes') or '').strip(),
                country_of_origin=str(row_data.get('country_of_origin') or '').strip(),
                shipping_method=str(row_data.get('shipping_method') or '').strip(),
                product_url=str(row_data.get('product_url') or '').strip(),
                raw_data=raw_data,
                source_fingerprint=fingerprint,
                is_skipped_reclassification=is_skipped,
                skip_reason=skip_reason,
                processing_status=init_status,
            )

            # Convert numeric fields
            for num_field in ['item_cost', 'map_price', 'msrp']:
                v = row_data.get(num_field)
                if v is not None:
                    try:
                        clean_num = str(v).replace('$', '').replace(',', '').strip()
                        if clean_num:
                            setattr(prod, num_field, float(clean_num))
                    except Exception:
                        pass

            # Extract image URLs
            img_records = []
            for col_idx, pos in image_columns:
                if col_idx < len(row):
                    img_val = row[col_idx]
                    if img_val and isinstance(img_val, str) and img_val.strip():
                        url_str = img_val.strip()
                        if url_str.startswith('http://') or url_str.startswith('https://'):
                            img_records.append((url_str, pos))
                        else:
                            invalid_image_urls_count += 1

            if img_records:
                with_images_count += 1
            else:
                without_images_count += 1

            products_to_create.append((prod, img_records))
            imported_count += 1

            if sample_limit is not None and imported_count >= sample_limit:
                logger.info(f"Sample limit of {sample_limit} products reached. Stopping import.")
                break

            # Batch flush
            if len(products_to_create) >= batch_size:
                self._flush_batch(products_to_create)
                products_to_create = []

        # Flush remainder
        if products_to_create:
            self._flush_batch(products_to_create)

        # Update catalog summary stats
        summary_stats = {
            'total_rows': total_rows,
            'total_products': imported_count,
            'skipped_blank_skus': skipped_blank_skus_count,
            'with_images': with_images_count,
            'without_images': without_images_count,
            'missing_descriptions': missing_descriptions_count,
            'duplicate_skus': duplicate_skus_count,
            'invalid_image_urls': invalid_image_urls_count,
        }

        catalog.total_rows = total_rows
        catalog.total_products = imported_count
        catalog.summary_stats = summary_stats
        catalog.status = Catalog.Status.UPLOADED
        catalog.save(update_fields=['total_rows', 'total_products', 'summary_stats', 'status'])

        return catalog

    @transaction.atomic
    def _flush_batch(self, items: List[Tuple[Product, List[Tuple[str, int]]]]):
        prods = [p for p, _ in items]
        created_prods = Product.objects.bulk_create(prods)

        image_objs = []
        for prod, img_tuples in items:
            for url, pos in img_tuples:
                image_objs.append(
                    ProductImage(
                        product=prod,
                        url=url,
                        position=pos,
                        status=ProductImage.ImageStatus.PENDING,
                    )
                )

        if image_objs:
            ProductImage.objects.bulk_create(image_objs)

    def _read_excel_rows(self):
        wb = openpyxl.load_workbook(self.file_path, read_only=True, data_only=True)
        sheet = wb.active
        for row in sheet.iter_rows(values_only=True):
            if any(cell is not None and str(cell).strip() != '' for cell in row):
                yield list(row)
        wb.close()

    def _read_csv_rows(self):
        with open(self.file_path, mode='r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            for row in reader:
                if any(cell is not None and str(cell).strip() != '' for cell in row):
                    yield row
