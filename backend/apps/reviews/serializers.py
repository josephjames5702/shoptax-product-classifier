from rest_framework import serializers
from .models import ReviewDecision
from apps.classification.serializers import ClassificationResultDetailSerializer
from apps.taxonomy.serializers import TaxonomyCategoryListSerializer

class ReviewDecisionSerializer(serializers.ModelSerializer):
    old_category = TaxonomyCategoryListSerializer(read_only=True)
    new_category = TaxonomyCategoryListSerializer(read_only=True)
    classification = ClassificationResultDetailSerializer(source='classification_result', read_only=True)

    class Meta:
        model = ReviewDecision
        fields = [
            'id', 'classification_result_id', 'classification', 'action', 'reviewer',
            'old_category', 'new_category', 'notes', 'created_at'
        ]
