from rest_framework import serializers
from .models import ClassificationResult, ClassificationAlternative, ExtractedAttribute
from apps.taxonomy.serializers import TaxonomyCategoryListSerializer

class ExtractedAttributeSerializer(serializers.ModelSerializer):
    attribute_name = serializers.CharField(source='attribute.name', read_only=True)
    attribute_external_id = serializers.CharField(source='attribute.external_id', read_only=True)

    class Meta:
        model = ExtractedAttribute
        fields = [
            'id', 'attribute_id', 'attribute_name', 'attribute_external_id',
            'raw_value', 'normalized_value', 'is_valid_taxonomy_value', 'source', 'confidence'
        ]


class ClassificationAlternativeSerializer(serializers.ModelSerializer):
    category = TaxonomyCategoryListSerializer(read_only=True)

    class Meta:
        model = ClassificationAlternative
        fields = ['id', 'category', 'rank', 'score', 'reason', 'supporting_evidence']


class ClassificationResultDetailSerializer(serializers.ModelSerializer):
    category = TaxonomyCategoryListSerializer(read_only=True)
    alternatives = ClassificationAlternativeSerializer(many=True, read_only=True)
    extracted_attributes = ExtractedAttributeSerializer(many=True, read_only=True)
    product_title = serializers.CharField(source='product.title', read_only=True)
    product_number = serializers.CharField(source='product.product_number', read_only=True)

    class Meta:
        model = ClassificationResult
        fields = [
            'id', 'product_id', 'product_title', 'product_number', 'taxonomy_version_id',
            'category', 'confidence_score', 'confidence_level', 'status',
            'evidence_codes', 'bm25_score', 'semantic_score', 'rrf_score',
            'hierarchical_score', 'ai_score', 'attribute_score', 'image_score', 'completeness_score',
            'was_ai_escalated', 'ai_provider', 'ai_model', 'retrieval_method', 'image_status',
            'reasoning', 'text_evidence', 'image_evidence', 'signals_breakdown',
            'model_version', 'created_at', 'updated_at', 'alternatives', 'extracted_attributes'
        ]
