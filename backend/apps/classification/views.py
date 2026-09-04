from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import ClassificationResult
from .serializers import ClassificationResultDetailSerializer
from apps.taxonomy.models import TaxonomyCategory
from apps.reviews.models import ReviewDecision
from apps.products.models import Product
from services.evaluation_service import EvaluationService

class ClassificationResultViewSet(viewsets.ModelViewSet):
    queryset = ClassificationResult.objects.select_related('product', 'category', 'taxonomy_version').prefetch_related('alternatives__category', 'extracted_attributes__attribute').all()
    serializer_class = ClassificationResultDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        catalog_id = self.request.query_params.get('catalog_id')
        if catalog_id:
            qs = qs.filter(product__catalog_id=catalog_id)

        confidence_level = self.request.query_params.get('confidence_level')
        if confidence_level:
            qs = qs.filter(confidence_level=confidence_level)

        review_status = self.request.query_params.get('status')
        if review_status:
            qs = qs.filter(status=review_status)

        return qs

    @action(detail=False, methods=['get'], url_path='metrics')
    def evaluate_metrics(self, request):
        catalog_id = request.query_params.get('catalog_id')
        if not catalog_id:
            return Response({'error': 'catalog_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            metrics = EvaluationService.evaluate_catalog(catalog_id)
            return Response(metrics)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        classification = self.get_object()
        reviewer = request.user.username if request.user.is_authenticated else request.data.get('reviewer', 'admin')
        notes = request.data.get('notes', 'Approved by administrator')

        from django.utils import timezone
        with transaction.atomic():
            classification.status = ClassificationResult.ReviewStatus.APPROVED
            classification.save(update_fields=['status', 'updated_at'])

            prod = classification.product
            prod.decision_status = Product.DecisionStatus.ADMIN_APPROVED
            prod.reviewed_by = reviewer
            prod.reviewed_at = timezone.now()
            prod.save(update_fields=['decision_status', 'reviewed_by', 'reviewed_at', 'updated_at'])

            ReviewDecision.objects.create(
                classification_result=classification,
                action=ReviewDecision.ActionType.APPROVE,
                reviewer=reviewer,
                notes=notes
            )

        return Response({
            'message': 'Product approved successfully.',
            'decision_status': prod.decision_status,
            'product_id': str(prod.id)
        })

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        classification = self.get_object()
        reviewer = request.user.username if request.user.is_authenticated else request.data.get('reviewer', 'admin')
        decline_reason = request.data.get('reason') or request.data.get('notes') or 'Declined by administrator'

        from django.utils import timezone
        with transaction.atomic():
            classification.status = ClassificationResult.ReviewStatus.REJECTED
            classification.save(update_fields=['status', 'updated_at'])

            prod = classification.product
            prod.decision_status = Product.DecisionStatus.ADMIN_DECLINED
            prod.reviewed_by = reviewer
            prod.reviewed_at = timezone.now()
            prod.decline_reason = decline_reason
            prod.save(update_fields=['decision_status', 'reviewed_by', 'reviewed_at', 'decline_reason', 'updated_at'])

            ReviewDecision.objects.create(
                classification_result=classification,
                action=ReviewDecision.ActionType.REJECT,
                reviewer=reviewer,
                notes=decline_reason
            )

        return Response({
            'message': 'Product declined successfully.',
            'decision_status': prod.decision_status,
            'product_id': str(prod.id)
        })

    @action(detail=True, methods=['post'], url_path='override')
    def override(self, request, pk=None):
        classification = self.get_object()
        new_category_id = request.data.get('category_id')
        reviewer = request.data.get('reviewer', 'system_admin')
        notes = request.data.get('notes', 'Category manually overridden')

        if not new_category_id:
            return Response({'error': 'category_id is required for override.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_cat = TaxonomyCategory.objects.get(id=new_category_id)
        except TaxonomyCategory.DoesNotExist:
            return Response({'error': 'Invalid Shopify taxonomy category ID.'}, status=status.HTTP_404_NOT_FOUND)

        old_cat = classification.category

        with transaction.atomic():
            classification.category = new_cat
            classification.status = ClassificationResult.ReviewStatus.OVERRIDDEN
            classification.confidence_score = 1.0
            classification.confidence_level = ClassificationResult.ConfidenceLevel.HIGH
            classification.reasoning = f"Manually overridden by {reviewer}. Notes: {notes}"
            classification.save(update_fields=['category', 'status', 'confidence_score', 'confidence_level', 'reasoning', 'updated_at'])

            prod = classification.product
            prod.processing_status = Product.ProcessingStatus.COMPLETED
            prod.save(update_fields=['processing_status', 'updated_at'])

            ReviewDecision.objects.create(
                classification_result=classification,
                action=ReviewDecision.ActionType.OVERRIDE,
                reviewer=reviewer,
                old_category=old_cat,
                new_category=new_cat,
                notes=notes
            )

        serializer = self.get_serializer(classification)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='bulk-approve-eligible')
    def bulk_approve_eligible(self, request):
        """
        Allows admin supervisor to automatically approve eligible products across a catalog or all catalogs.
        """
        catalog_id = request.data.get('catalog_id')
        reviewer = request.user.username if request.user.is_authenticated else request.data.get('reviewer', 'admin')
        notes = request.data.get('notes', 'Automatically approved by administrator')

        from django.utils import timezone
        qs = ClassificationResult.objects.select_related('product')
        if catalog_id and catalog_id != 'ALL':
            qs = qs.filter(product__catalog_id=catalog_id)

        # Target results that are not yet approved/declined
        target_results = list(qs.exclude(status__in=[
            ClassificationResult.ReviewStatus.APPROVED,
            ClassificationResult.ReviewStatus.REJECTED
        ]))

        count = 0
        with transaction.atomic():
            now = timezone.now()
            prods_to_update = []
            decisions_to_create = []

            for cr in target_results:
                cr.status = ClassificationResult.ReviewStatus.APPROVED
                cr.updated_at = now
                cr.save(update_fields=['status', 'updated_at'])

                prod = cr.product
                prod.decision_status = Product.DecisionStatus.ADMIN_APPROVED
                prod.reviewed_by = reviewer
                prod.reviewed_at = now
                prods_to_update.append(prod)

                decisions_to_create.append(
                    ReviewDecision(
                        classification_result=cr,
                        action=ReviewDecision.ActionType.APPROVE,
                        reviewer=reviewer,
                        notes=notes
                    )
                )
                count += 1

            if prods_to_update:
                Product.objects.bulk_update(prods_to_update, ['decision_status', 'reviewed_by', 'reviewed_at', 'updated_at'], batch_size=500)
            if decisions_to_create:
                ReviewDecision.objects.bulk_create(decisions_to_create, batch_size=500)

        return Response({
            'message': f'Successfully approved {count} products automatically.',
            'approved_count': count
        }, status=status.HTTP_200_OK)

