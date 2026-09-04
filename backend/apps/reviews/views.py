from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import ReviewDecision
from .serializers import ReviewDecisionSerializer
from apps.classification.models import ClassificationResult
from apps.classification.serializers import ClassificationResultDetailSerializer
from apps.products.models import Product

class ReviewViewSet(viewsets.ViewSet):
    def list(self, request):
        # Query classifications needing manual review
        catalog_id = request.query_params.get('catalog_id')
        reason_filter = request.query_params.get('reason')
        
        qs = ClassificationResult.objects.filter(
            Q(status=ClassificationResult.ReviewStatus.PENDING_REVIEW) |
            Q(product__processing_status=Product.ProcessingStatus.REQUIRES_REVIEW) |
            Q(product__processing_status=Product.ProcessingStatus.MANUAL_REVIEW)
        ).select_related('product', 'category').prefetch_related('alternatives__category', 'extracted_attributes__attribute')

        if catalog_id and catalog_id != 'ALL':
            qs = qs.filter(product__catalog_id=catalog_id)

        # Pagination
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(qs, request)
        
        serializer = ClassificationResultDetailSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @action(detail=False, methods=['get'], url_path='history')
    def get_decision_history(self, request):
        decisions = ReviewDecision.objects.select_related('classification_result__product', 'old_category', 'new_category').all()
        catalog_id = request.query_params.get('catalog_id')
        if catalog_id:
            decisions = decisions.filter(classification_result__product__catalog_id=catalog_id)

        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 25
        page = paginator.paginate_queryset(decisions, request)
        serializer = ReviewDecisionSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @action(detail=False, methods=['post'], url_path='bulk-approve')
    def bulk_approve(self, request):
        classification_ids = request.data.get('classification_ids', [])
        reviewer = request.data.get('reviewer', 'bulk_reviewer')
        
        results = ClassificationResult.objects.filter(id__in=classification_ids)
        updated_count = 0
        
        for res in results:
            res.status = ClassificationResult.ReviewStatus.APPROVED
            res.save(update_fields=['status'])
            res.product.processing_status = Product.ProcessingStatus.COMPLETED
            res.product.save(update_fields=['processing_status'])
            
            ReviewDecision.objects.create(
                classification_result=res,
                action=ReviewDecision.ActionType.APPROVE,
                reviewer=reviewer,
                notes='Bulk approved'
            )
            updated_count += 1

        return Response({'message': f'Successfully approved {updated_count} classifications.'})
