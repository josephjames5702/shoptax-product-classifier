"""
Image Download and Validation Service.
Features:
- Validates URLs and applies strict timeout limits
- Handles HTTP errors and corrupt image formats gracefully
- Deduplicates images via SHA-256 hash
- Validates dimensions and format using Pillow
- Never allows a broken image to halt batch classification
"""

import os
import io
import hashlib
import logging
import httpx
from PIL import Image
from typing import Optional, Tuple
from django.conf import settings
from apps.products.models import ProductImage

logger = logging.getLogger(__name__)

class ImageService:
    def __init__(self, timeout_seconds: int = 10, max_size_bytes: int = 10 * 1024 * 1024):
        self.timeout_seconds = timeout_seconds
        self.max_size_bytes = max_size_bytes
        self.media_img_dir = os.path.join(settings.BASE_DIR, 'media', 'product_images')
        os.makedirs(self.media_img_dir, exist_ok=True)

    def download_and_validate(self, product_image: ProductImage) -> ProductImage:
        """
        Downloads the image from product_image.url, validates format/dimensions,
        saves locally, and updates product_image model instance.
        """
        url = product_image.url
        if not url or not (url.startswith('http://') or url.startswith('https://')):
            product_image.status = ProductImage.ImageStatus.INVALID
            product_image.error_message = f"Invalid image URL scheme: {url}"
            product_image.save(update_fields=['status', 'error_message'])
            return product_image

        try:
            with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
                response = client.get(url)

            if response.status_code != 200:
                product_image.status = ProductImage.ImageStatus.FAILED
                product_image.error_message = f"HTTP status {response.status_code}"
                product_image.save(update_fields=['status', 'error_message'])
                return product_image

            content = response.content
            if len(content) > self.max_size_bytes:
                product_image.status = ProductImage.ImageStatus.FAILED
                product_image.error_message = f"Image size exceeds limit ({len(content)} bytes)"
                product_image.save(update_fields=['status', 'error_message'])
                return product_image

            # Calculate SHA-256 hash
            img_hash = hashlib.sha256(content).hexdigest()
            product_image.image_hash = img_hash

            # Validate with Pillow
            try:
                img = Image.open(io.BytesIO(content))
                img.verify() # Verify integrity
                
                # Reopen to read dimensions/format after verify
                img = Image.open(io.BytesIO(content))
                width, height = img.size
                img_format = img.format.lower() if img.format else 'jpg'
                
                product_image.width = width
                product_image.height = height

                # Save locally
                local_filename = f"{img_hash[:16]}.{img_format}"
                local_file_path = os.path.join(self.media_img_dir, local_filename)

                if not os.path.exists(local_file_path):
                    with open(local_file_path, 'wb') as f:
                        f.write(content)

                product_image.local_path = os.path.join('product_images', local_filename)
                product_image.status = ProductImage.ImageStatus.DOWNLOADED
                product_image.error_message = None
                product_image.save(update_fields=['status', 'error_message', 'image_hash', 'width', 'height', 'local_path'])
                return product_image

            except Exception as pil_err:
                product_image.status = ProductImage.ImageStatus.INVALID
                product_image.error_message = f"Invalid image format: {str(pil_err)}"
                product_image.save(update_fields=['status', 'error_message'])
                return product_image

        except httpx.TimeoutException:
            product_image.status = ProductImage.ImageStatus.FAILED
            product_image.error_message = f"Download timed out after {self.timeout_seconds}s"
            product_image.save(update_fields=['status', 'error_message'])
            return product_image
        except Exception as e:
            product_image.status = ProductImage.ImageStatus.FAILED
            product_image.error_message = f"Download error: {str(e)}"
            product_image.save(update_fields=['status', 'error_message'])
            return product_image
