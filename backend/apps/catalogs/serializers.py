from rest_framework import serializers
from .models import Catalog

class CatalogSerializer(serializers.ModelSerializer):
    owner_username = serializers.SerializerMethodField()

    class Meta:
        model = Catalog
        fields = [
            'id', 'owner', 'owner_username', 'name', 'file_name', 'file_size', 'total_rows', 'total_products',
            'status', 'summary_stats', 'column_mapping', 'file_path', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'owner', 'owner_username', 'status', 'summary_stats', 'column_mapping', 'created_at', 'updated_at']

    def get_owner_username(self, obj):
        return obj.owner.username if obj.owner else 'Anonymous'
