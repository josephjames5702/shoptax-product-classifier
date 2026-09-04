from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Product
from .serializers import ProductListSerializer, ProductDetailSerializer, ProductCreateSerializer

class ProductViewSet(mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.select_related('catalog').prefetch_related('images', 'classification_result__category').all()

    def get_serializer_class(self):
        if self.action == 'create':
            return ProductCreateSerializer
        if self.action == 'retrieve':
            return ProductDetailSerializer
        return ProductListSerializer

    def perform_create(self, serializer):
        product = serializer.save(
            processing_status=Product.ProcessingStatus.PENDING,
            decision_status=Product.DecisionStatus.NOT_REVIEWED
        )
        if product.catalog:
            product.catalog.total_products = product.catalog.products.count()
            product.catalog.save(update_fields=['total_products'])

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Enforce catalogue ownership unless user is staff / admin
        if user.is_authenticated and not user.is_staff:
            qs = qs.filter(catalog__owner=user)

        catalog_id = self.request.query_params.get('catalog_id')
        if catalog_id and catalog_id != 'ALL':
            qs = qs.filter(catalog_id=catalog_id)

        # Filter by decision_status (ADMIN_APPROVED, ADMIN_DECLINED, REQUIRES_REVIEW, etc.)
        decision_param = self.request.query_params.get('decision_status')
        if decision_param:
            qs = qs.filter(decision_status=decision_param)

        status_param = self.request.query_params.get('status')
        if status_param:
            status_lower = status_param.lower().replace('_', ' ').replace('-', ' ').strip()
            if status_lower in ['completed', 'classified', 'auto approved', 'auto_approved']:
                qs = qs.filter(
                    Q(processing_status__in=['AUTO_APPROVED', 'CLASSIFIED', 'COMPLETED']) |
                    Q(decision_status='AUTO_CLASSIFIED')
                )
            elif status_lower in ['approved', 'approved all', 'all approved']:
                # User and supervisor expectation: "Approved" captures both automatically approved and admin approved items
                qs = qs.filter(
                    Q(decision_status__in=['ADMIN_APPROVED', 'AUTO_CLASSIFIED']) |
                    Q(processing_status__in=['AUTO_APPROVED', 'CLASSIFIED', 'COMPLETED'])
                )
            elif status_lower in ['admin approved', 'admin_approved']:
                qs = qs.filter(decision_status=Product.DecisionStatus.ADMIN_APPROVED)
            elif status_lower in ['manual review', 'manual_review', 'requires review', 'requires_review', 'review']:
                qs = qs.filter(
                    Q(processing_status__in=['REQUIRES_REVIEW', 'MANUAL_REVIEW']) |
                    Q(decision_status='REQUIRES_REVIEW')
                )
            elif status_lower in ['pending']:
                qs = qs.filter(
                    Q(processing_status='PENDING') |
                    Q(decision_status='NOT_REVIEWED')
                )
            elif status_lower in ['processing']:
                qs = qs.filter(processing_status='PROCESSING')
            elif status_lower in ['failed', 'rejected']:
                qs = qs.filter(processing_status='FAILED')
            elif status_lower in ['declined', 'admin declined', 'admin_declined']:
                qs = qs.filter(
                    Q(decision_status=Product.DecisionStatus.ADMIN_DECLINED) |
                    Q(processing_status='FAILED')
                )
            else:
                qs = qs.filter(
                    Q(processing_status__iexact=status_param) |
                    Q(decision_status__iexact=status_param)
                )

        category_param = self.request.query_params.get('category')
        if category_param and category_param != 'All Items':
            if category_param == 'Unclassified':
                qs = qs.filter(classification_result__isnull=True)
            else:
                qs = qs.filter(classification_result__category__name=category_param)

        confidence_param = self.request.query_params.get('confidence_level')
        if confidence_param:
            qs = qs.filter(classification_result__confidence_level=confidence_param)

        brand_param = self.request.query_params.get('brand')
        if brand_param:
            qs = qs.filter(brand__iexact=brand_param)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(product_number__icontains=search) |
                Q(brand__icontains=search) |
                Q(model_number__icontains=search)
            )

        return qs

    def perform_destroy(self, instance):
        catalog = instance.catalog
        instance.delete()
        if catalog:
            catalog.total_products = catalog.products.count()
            catalog.save(update_fields=['total_products'])

    @action(detail=True, methods=['get'], url_path='classification')
    def get_classification(self, request, pk=None):
        product = self.get_object()
        if not hasattr(product, 'classification_result'):
            return Response({'error': 'Product has not been classified yet.'}, status=status.HTTP_404_NOT_FOUND)
        
        from apps.classification.serializers import ClassificationResultDetailSerializer
        serializer = ClassificationResultDetailSerializer(product.classification_result)
        return Response(serializer.data)
