from rest_framework import serializers
from .models import (
    TaxonomyVersion,
    TaxonomyCategory,
    TaxonomyAttribute,
    TaxonomyAttributeValue,
    CategoryAttribute,
)


class TaxonomyVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxonomyVersion
        fields = [
            'id',
            'version_code',
            'release_tag',
            'release_name',
            'release_status',
            'name',
            'status',
            'is_active',
            'source_urls',
            'asset_checksums',
            'stats',
            'error_message',
            'imported_at',
            'completed_at',
        ]


class TaxonomyAttributeValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxonomyAttributeValue
        fields = ['id', 'external_id', 'name', 'handle', 'normalized_name']


class TaxonomyAttributeSerializer(serializers.ModelSerializer):
    values = TaxonomyAttributeValueSerializer(many=True, read_only=True)

    class Meta:
        model = TaxonomyAttribute
        fields = ['id', 'external_id', 'name', 'handle', 'description', 'data_type', 'values']


class TaxonomyCategoryListSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxonomyCategory
        fields = ['id', 'external_id', 'name', 'full_path', 'level', 'is_leaf', 'is_root', 'parent_id']


class TaxonomyCategoryDetailSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    ancestors = serializers.SerializerMethodField()
    attributes = serializers.SerializerMethodField()
    return_reasons = serializers.SerializerMethodField()

    class Meta:
        model = TaxonomyCategory
        fields = [
            'id',
            'external_id',
            'name',
            'full_path',
            'level',
            'is_leaf',
            'is_root',
            'parent_id',
            'ancestor_ids',
            'children_ids',
            'children',
            'ancestors',
            'attributes',
            'return_reasons',
        ]

    def get_children(self, obj):
        children = obj.children_categories.all().order_by('name')
        return TaxonomyCategoryListSerializer(children, many=True).data

    def get_ancestors(self, obj):
        if not obj.ancestor_ids:
            return []
        ancestors = TaxonomyCategory.objects.filter(
            taxonomy_version=obj.taxonomy_version,
            external_id__in=obj.ancestor_ids,
        ).order_by('level')
        return TaxonomyCategoryListSerializer(ancestors, many=True).data

    def get_attributes(self, obj):
        cat_attrs = CategoryAttribute.objects.filter(category=obj).select_related('attribute').prefetch_related('attribute__values')
        results = []
        for ca in cat_attrs:
            attr_data = TaxonomyAttributeSerializer(ca.attribute).data
            attr_data['is_required'] = ca.is_required
            attr_data['is_extended'] = ca.is_extended
            results.append(attr_data)
        return results

    def get_return_reasons(self, obj):
        if isinstance(obj.raw_data, dict):
            return obj.raw_data.get('return_reasons', [])
        return []
