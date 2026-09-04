import os
import tempfile
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.conf import settings
from .models import Catalog
from .serializers import CatalogSerializer
from services.import_service import ImportService
from apps.jobs.models import ProcessingJob
from apps.products.models import Product

logger = logging.getLogger(__name__)

class CatalogViewSet(viewsets.ModelViewSet):
    queryset = Catalog.objects.all()
    serializer_class = CatalogSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        # Shared database: return all catalogs so both admin and seller counts match and can be managed
        return Catalog.objects.all().select_related('owner')

    def destroy(self, request, *args, **kwargs):
        catalog_id = kwargs.get('pk')
        catalog = Catalog.objects.filter(id=catalog_id).first()
        if not catalog:
            return Response({'message': 'Catalogue already removed.'}, status=status.HTTP_200_OK)

        if catalog.file_path and os.path.exists(catalog.file_path):
            try:
                os.unlink(catalog.file_path)
            except Exception:
                pass
        catalog.delete()
        return Response({'message': 'Catalogue successfully deleted.'}, status=status.HTTP_200_OK)

    def perform_destroy(self, instance):
        if instance.file_path and os.path.exists(instance.file_path):
            try:
                os.unlink(instance.file_path)
            except Exception:
                pass
        instance.delete()

    @action(detail=False, methods=['post'], url_path='reset')
    def reset_catalogs(self, request):
        """
        Wipes all uploaded catalogs, products, jobs, and classifications,
        leaving the database completely clean and waiting for a new upload.
        Taxonomy versions and categories are strictly preserved.
        """
        count = Catalog.objects.count()
        Catalog.objects.all().delete()

        # Clean up files in media/uploads
        upload_dir = os.path.join(settings.BASE_DIR, 'media', 'uploads')
        if os.path.exists(upload_dir):
            for f in os.listdir(upload_dir):
                file_path = os.path.join(upload_dir, f)
                try:
                    if os.path.isfile(file_path):
                        os.unlink(file_path)
                except Exception:
                    pass

        return Response({
            'message': 'All uploaded catalogues, products, and jobs successfully removed.',
            'removed_catalogs_count': count
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='upload')
    def upload_catalog(self, request):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'error': 'No file uploaded. Please provide a CSV or XLSX file.'}, status=status.HTTP_400_BAD_REQUEST)

        catalog_name = request.data.get('name') or os.path.splitext(uploaded_file.name)[0]
        ext = os.path.splitext(uploaded_file.name)[1].lower()
        if ext not in ['.csv', '.xlsx', '.xls']:
            return Response({'error': f'Unsupported file type: {ext}. Please upload a .csv or .xlsx file.'}, status=status.HTTP_400_BAD_REQUEST)

        # Save to temp / media directory
        upload_dir = os.path.join(settings.BASE_DIR, 'media', 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        saved_path = os.path.join(upload_dir, f"{catalog_name}_{uploaded_file.name}")

        with open(saved_path, 'wb+') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)

        try:
            importer = ImportService(
                catalog_name=catalog_name,
                file_path=saved_path,
                original_filename=uploaded_file.name
            )
            sample_size_raw = request.data.get('sample_size') or request.query_params.get('sample_size')
            sample_size = int(sample_size_raw) if sample_size_raw else 100
            catalog = importer.parse_and_create(batch_size=50, sample_limit=sample_size)
            catalog.status = Catalog.Status.UPLOADED
            if request.user and request.user.is_authenticated:
                catalog.owner = request.user
                catalog.save(update_fields=['status', 'owner'])
            else:
                catalog.save(update_fields=['status'])

            catalog_data = self.get_serializer(catalog).data
            response_data = {
                'success': True,
                'catalog_id': str(catalog.id),
                'catalog_name': catalog.name,
                'filename': catalog.file_name,
                'total_rows': catalog.total_rows,
                'total_products': catalog.total_products,
                'products_imported': catalog.total_products,
                'products_rejected': 0,
                'status': catalog.status,
                'classification_status': 'CLASSIFICATION_PENDING',
                'catalog': catalog_data,
                **catalog_data
            }
            return Response(response_data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.exception("Failed to import catalog")
            return Response({'error': f'Catalog import failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='start-classification')
    def start_classification(self, request, pk=None):
        catalog = self.get_object()
        
        # Resume/Retry parameter
        retry_failed_only = request.data.get('retry_failed_only', False)

        # Check existing running job
        existing_job = ProcessingJob.objects.filter(
            catalog=catalog,
            status=ProcessingJob.JobStatus.RUNNING
        ).first()

        if existing_job:
            return Response({
                'message': 'A classification job is already running for this catalog.',
                'job_id': str(existing_job.id),
                'progress_percentage': existing_job.progress_percentage
            }, status=status.HTTP_200_OK)

        job_type = ProcessingJob.JobType.RETRY_FAILED if retry_failed_only else ProcessingJob.JobType.CLASSIFICATION
        
        # Target products count
        if retry_failed_only:
            target_count = catalog.products.filter(
                processing_status__in=[Product.ProcessingStatus.FAILED, Product.ProcessingStatus.RETRYING]
            ).count()
        else:
            target_count = catalog.products.filter(
                processing_status__in=[Product.ProcessingStatus.PENDING, Product.ProcessingStatus.FAILED, Product.ProcessingStatus.RETRYING]
            ).count()

        job = ProcessingJob.objects.create(
            catalog=catalog,
            job_type=job_type,
            status=ProcessingJob.JobStatus.PENDING,
            total_items=target_count,
            current_step='Queued for execution',
        )

        catalog.status = Catalog.Status.PROCESSING
        catalog.save(update_fields=['status'])

        # Launch high-throughput batch classification in background thread
        import threading
        from django.db import connection

        catalog_id_str = str(catalog.id)
        job_id_str = str(job.id)

        def _run_pipeline_bg():
            from django.db import connection
            connection.close() # Fresh connection for background worker thread
            try:
                from services.pipeline_runner import PipelineRunner
                cat_instance = Catalog.objects.get(id=catalog_id_str)
                job_instance = ProcessingJob.objects.get(id=job_id_str)
                runner = PipelineRunner(cat_instance, job_instance, batch_size=25)
                runner.run(retry_failed_only=retry_failed_only)
            except Exception as e:
                logger.exception(f"Background classification failed: {e}")
            finally:
                connection.close()

        bg_thread = threading.Thread(target=_run_pipeline_bg, daemon=True)
        bg_thread.start()

        return Response({
            'message': 'Classification job initiated successfully.',
            'job_id': str(job.id),
            'target_products': target_count,
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['post'], url_path='classify')
    def classify(self, request, pk=None):
        return self.start_classification(request, pk=pk)

    @action(detail=True, methods=['get'], url_path='category-summary')
    def get_category_summary(self, request, pk=None):
        """
        Aggregates classification results by canonical Shopify taxonomy category ID/GID.
        Returns unique categories count and product distribution without fake data.
        """
        catalog = self.get_object()
        from apps.classification.models import ClassificationResult
        from django.db.models import Count

        grouped = (
            ClassificationResult.objects.filter(product__catalog=catalog)
            .values(
                'category__id',
                'category__external_id',
                'category__name',
                'category__full_path',
                'category__level',
                'category__is_leaf'
            )
            .annotate(product_count=Count('id'))
            .order_by('-product_count')
        )

        total_classified = sum(item['product_count'] for item in grouped)
        unique_categories = len(grouped)

        categories_data = [
            {
                'category_id': item['category__id'],
                'category_gid': item['category__external_id'],
                'name': item['category__name'],
                'full_path': item['category__full_path'],
                'level': item['category__level'],
                'is_leaf': item['category__is_leaf'],
                'product_count': item['product_count'],
            }
            for item in grouped
        ]

        return Response({
            'catalog_id': str(catalog.id),
            'catalog_name': catalog.name,
            'total_products': catalog.total_products,
            'total_classified': total_classified,
            'unique_categories_count': unique_categories,
            'categories': categories_data
        })

    @action(detail=True, methods=['get'], url_path='grouped-products')
    def get_grouped_products(self, request, pk=None):
        """
        Returns products grouped under canonical Shopify categories.
        Each product remains an individual record with SKU, title, status, and confidence.
        """
        catalog = self.get_object()
        category_gid = request.query_params.get('category_gid')
        category_id = request.query_params.get('category_id')

        from apps.classification.models import ClassificationResult
        qs = ClassificationResult.objects.filter(product__catalog=catalog).select_related('product', 'category')

        if category_gid:
            qs = qs.filter(category__external_id=category_gid)
        elif category_id:
            qs = qs.filter(category__id=category_id)

        items = []
        for cr in qs[:300]:
            p = cr.product
            items.append({
                'classification_id': str(cr.id),
                'product_id': str(p.id),
                'product_number': p.product_number,
                'title': p.title,
                'brand': p.brand,
                'product_type': p.product_type,
                'status': cr.status,
                'confidence_score': cr.confidence_score,
                'confidence_level': cr.confidence_level,
                'category_id': cr.category.id,
                'category_gid': cr.category.external_id,
                'category_name': cr.category.name,
                'category_full_path': cr.category.full_path,
            })

        return Response({
            'catalog_id': str(catalog.id),
            'count': len(items),
            'products': items
        })

    @action(detail=True, methods=['get'], url_path='progress')
    def get_progress(self, request, pk=None):
        catalog = self.get_object()
        total = catalog.products.count()
        completed = catalog.products.filter(
            processing_status__in=[
                Product.ProcessingStatus.AUTO_APPROVED,
                Product.ProcessingStatus.CLASSIFIED,
                Product.ProcessingStatus.COMPLETED,
            ]
        ).count()
        failed = catalog.products.filter(processing_status=Product.ProcessingStatus.FAILED).count()
        manual_review = catalog.products.filter(
            processing_status__in=[
                Product.ProcessingStatus.REQUIRES_REVIEW,
                Product.ProcessingStatus.MANUAL_REVIEW,
            ]
        ).count()
        pending = catalog.products.filter(processing_status=Product.ProcessingStatus.PENDING).count()
        processing = catalog.products.filter(processing_status=Product.ProcessingStatus.PROCESSING).count()
        retrying = catalog.products.filter(processing_status=Product.ProcessingStatus.RETRYING).count()

        latest_job = catalog.processing_jobs.order_by('-created_at').first()

        pct = (completed + failed + manual_review) / total * 100.0 if total > 0 else 0.0

        return Response({
            'catalog_id': str(catalog.id),
            'catalog_status': catalog.status,
            'total_products': total,
            'completed': completed,
            'failed': failed,
            'manual_review': manual_review,
            'pending': pending,
            'processing': processing,
            'retrying': retrying,
            'progress_percentage': round(pct, 2),
            'latest_job': {
                'id': str(latest_job.id) if latest_job else None,
                'status': latest_job.status if latest_job else None,
                'job_type': latest_job.job_type if latest_job else None,
                'current_step': latest_job.current_step if latest_job else None,
            } if latest_job else None
        })

    @action(detail=False, methods=['get'], url_path='all-progress')
    def get_all_progress(self, request):
        total = Product.objects.count()
        completed = Product.objects.filter(
            processing_status__in=[
                Product.ProcessingStatus.AUTO_APPROVED,
                Product.ProcessingStatus.CLASSIFIED,
                Product.ProcessingStatus.COMPLETED,
            ]
        ).count()
        failed = Product.objects.filter(processing_status=Product.ProcessingStatus.FAILED).count()
        manual_review = Product.objects.filter(
            processing_status__in=[
                Product.ProcessingStatus.REQUIRES_REVIEW,
                Product.ProcessingStatus.MANUAL_REVIEW,
            ]
        ).count()
        pending = Product.objects.filter(processing_status=Product.ProcessingStatus.PENDING).count()
        processing = Product.objects.filter(processing_status=Product.ProcessingStatus.PROCESSING).count()
        retrying = Product.objects.filter(processing_status=Product.ProcessingStatus.RETRYING).count()

        pct = (completed + failed + manual_review) / total * 100.0 if total > 0 else 0.0

        return Response({
            'catalog_id': 'ALL',
            'catalog_status': 'COMPLETED' if pending == 0 and processing == 0 else 'PROCESSING',
            'total_products': total,
            'completed': completed,
            'failed': failed,
            'manual_review': manual_review,
            'pending': pending,
            'processing': processing,
            'retrying': retrying,
            'progress_percentage': round(pct, 2),
            'latest_job': None
        })

    @action(detail=False, methods=['get'], url_path='all-category-summary')
    def get_all_category_summary(self, request):
        from apps.classification.models import ClassificationResult
        from django.db.models import Count

        grouped = (
            ClassificationResult.objects.all()
            .values(
                'category__id',
                'category__external_id',
                'category__name',
                'category__full_path',
                'category__level',
                'category__is_leaf'
            )
            .annotate(product_count=Count('id'))
            .order_by('-product_count')
        )

        categories_data = [
            {
                'category_id': item['category__id'],
                'category_gid': item['category__external_id'],
                'name': item['category__name'],
                'full_path': item['category__full_path'],
                'level': item['category__level'],
                'is_leaf': item['category__is_leaf'],
                'product_count': item['product_count'],
            }
            for item in grouped
        ]

        return Response({
            'catalog_id': 'ALL',
            'unique_categories_count': len(grouped),
            'total_classified_products': sum(item['product_count'] for item in grouped),
            'categories': categories_data
        })

    @action(detail=False, methods=['get'], url_path='stats')
    def get_stats(self, request):
        """
        Global or user-scoped overview stats directly computed in SQL.
        """
        from django.db.models import Q
        user = request.user

        cat_qs = Catalog.objects.all()
        prod_qs = Product.objects.all()

        if user.is_authenticated and not user.is_staff:
            cat_qs = cat_qs.filter(owner=user)
            prod_qs = prod_qs.filter(catalog__owner=user)

        total_catalogs = cat_qs.count()
        total_products = prod_qs.count()

        classified_count = prod_qs.filter(
            Q(processing_status__in=['AUTO_APPROVED', 'CLASSIFIED', 'COMPLETED']) |
            Q(decision_status='AUTO_CLASSIFIED')
        ).count()

        needs_review_count = prod_qs.filter(
            Q(processing_status__in=['REQUIRES_REVIEW', 'MANUAL_REVIEW']) |
            Q(decision_status='REQUIRES_REVIEW')
        ).count()

        approved_count = prod_qs.filter(
            decision_status=Product.DecisionStatus.ADMIN_APPROVED
        ).count()

        declined_count = prod_qs.filter(
            Q(decision_status=Product.DecisionStatus.ADMIN_DECLINED) |
            Q(processing_status='FAILED')
        ).count()

        pending_count = prod_qs.filter(
            Q(processing_status='PENDING') |
            Q(decision_status='NOT_REVIEWED')
        ).count()

        return Response({
            'total_catalogs': total_catalogs,
            'total_products': total_products,
            'classified_count': classified_count,
            'needs_review_count': needs_review_count,
            'approved_count': approved_count,
            'declined_count': declined_count,
            'pending_count': pending_count,
        })

