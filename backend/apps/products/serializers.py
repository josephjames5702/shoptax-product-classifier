from rest_framework import serializers
from .models import Product, ProductImage

class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'url', 'position', 'status', 'error_message', 'image_hash', 'local_path', 'width', 'height', 'created_at']


class ProductListSerializer(serializers.ModelSerializer):
    primary_image = serializers.SerializerMethodField()
    classification_summary = serializers.SerializerMethodField()
    catalog_name = serializers.SerializerMethodField()
    catalog_owner_username = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'catalog_id', 'catalog_name', 'catalog_owner_username', 'product_number', 'model_number', 'title', 'brand',
            'product_type', 'color', 'materials', 'processing_status', 'decision_status',
            'reviewed_by', 'reviewed_at', 'decline_reason',
            'attempts', 'last_error', 'last_processed_at', 'created_at', 'primary_image', 'classification_summary'
        ]

    def get_catalog_name(self, obj):
        return obj.catalog.name if obj.catalog else ''

    def get_catalog_owner_username(self, obj):
        if obj.catalog and obj.catalog.owner:
            return obj.catalog.owner.username
        return 'User'

    def get_primary_image(self, obj):
        img = obj.images.order_by('position').first()
        return img.url if img else None

    def get_classification_summary(self, obj):
        if hasattr(obj, 'classification_result'):
            res = obj.classification_result
            attrs = [
                {
                    'name': ea.attribute.name if ea.attribute else 'Attribute',
                    'value': ea.normalized_value or ea.raw_value
                }
                for ea in res.extracted_attributes.all()[:4]
            ]
            alts = [
                {
                    'category_name': alt.category.name if alt.category else '',
                    'score': round(alt.score * 100, 1)
                }
                for alt in res.alternatives.all()[:3]
            ]
            return {
                'id': str(res.id),
                'category_name': res.category.name if res.category else 'Unknown',
                'category_path': res.category.full_path if res.category else '',
                'confidence_score': res.confidence_score,
                'confidence_level': res.confidence_level,
                'status': res.status,
                'ai_mode': res.ai_mode,
                'attributes': attrs,
                'alternatives': alts,
                'reasoning': res.reasoning,
            }
        return None


class ProductDetailSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    classification_result = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'catalog_id', 'product_number', 'model_number', 'title', 'description',
            'bullets', 'brand', 'product_type', 'materials', 'color', 'color_collection',
            'dimensions', 'set_includes', 'item_cost', 'map_price', 'msrp', 'country_of_origin',
            'shipping_method', 'product_url', 'raw_data', 'processing_status', 'attempts',
            'last_error', 'last_processed_at', 'created_at', 'updated_at', 'images', 'classification_result'
        ]

    def get_classification_result(self, obj):
        if hasattr(obj, 'classification_result'):
            from apps.classification.serializers import ClassificationResultDetailSerializer
            return ClassificationResultDetailSerializer(obj.classification_result).data
        return None


class ProductCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            'catalog', 'product_number', 'model_number', 'title', 'description',
            'bullets', 'brand', 'product_type', 'materials', 'color',
            'dimensions', 'country_of_origin', 'shipping_method', 'product_url'
        ]
