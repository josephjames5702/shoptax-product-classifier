from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.shortcuts import get_object_or_404
from .models import (
    TaxonomyVersion,
    TaxonomyCategory,
    TaxonomyAttribute,
    CategoryAttribute,
)
from .serializers import (
    TaxonomyVersionSerializer,
    TaxonomyCategoryListSerializer,
    TaxonomyCategoryDetailSerializer,
    TaxonomyAttributeSerializer,
)


class TaxonomyVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TaxonomyVersion.objects.all().order_by('-imported_at')
    serializer_class = TaxonomyVersionSerializer

    @action(detail=False, methods=['get'], url_path='active')
    def get_active_version(self, request):
        active_version = TaxonomyVersion.objects.filter(is_active=True).first()
        if not active_version:
            return Response({'error': 'No active taxonomy version found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(active_version)
        return Response(serializer.data)


class TaxonomyCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TaxonomyCategory.objects.all()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TaxonomyCategoryDetailSerializer
        return TaxonomyCategoryListSerializer

    def get_object(self):
        lookup = self.kwargs.get('pk')
        # Check if lookup is an integer PK or external_id string
        if lookup.isdigit():
            return get_object_or_404(TaxonomyCategory, pk=int(lookup))
        return get_object_or_404(TaxonomyCategory, external_id=lookup)

    def get_queryset(self):
        qs = super().get_queryset()
        
        # Filter by active version by default if not specified
        version_code = self.request.query_params.get('version')
        if version_code:
            qs = qs.filter(taxonomy_version__version_code=version_code)
        else:
            active_version = TaxonomyVersion.objects.filter(is_active=True).first()
            if active_version:
                qs = qs.filter(taxonomy_version=active_version)

        is_leaf = self.request.query_params.get('is_leaf')
        if is_leaf is not None:
            qs = qs.filter(is_leaf=(is_leaf.lower() in ('true', '1')))

        is_root = self.request.query_params.get('is_root')
        if is_root is not None:
            qs = qs.filter(is_root=(is_root.lower() in ('true', '1')))

        parent_id = self.request.query_params.get('parent_id')
        if parent_id:
            if parent_id.isdigit():
                qs = qs.filter(parent_id=int(parent_id))
            else:
                qs = qs.filter(parent__external_id=parent_id)

        level = self.request.query_params.get('level')
        if level is not None and level.isdigit():
            qs = qs.filter(level=int(level))

        search = self.request.query_params.get('search')
        if search:
            search_term = search.strip()
            qs = qs.filter(
                Q(name__icontains=search_term) |
                Q(full_path__icontains=search_term) |
                Q(external_id__icontains=search_term)
            )

        return qs

    @action(detail=True, methods=['get'], url_path='children')
    def get_category_children(self, request, pk=None):
        category = self.get_object()
        children = category.children_categories.all().order_by('name')
        serializer = TaxonomyCategoryListSerializer(children, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='attributes')
    def get_category_attributes(self, request, pk=None):
        category = self.get_object()
        cat_attrs = CategoryAttribute.objects.filter(category=category).select_related('attribute').prefetch_related('attribute__values')
        
        results = []
        for ca in cat_attrs:
            attr_data = TaxonomyAttributeSerializer(ca.attribute).data
            attr_data['is_required'] = ca.is_required
            attr_data['is_extended'] = ca.is_extended
            results.append(attr_data)
            
        return Response(results)

    @action(detail=False, methods=['get'], url_path='tree')
    def get_root_tree(self, request):
        qs = self.get_queryset().filter(is_root=True).order_by('name')
        serializer = TaxonomyCategoryListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='roots')
    def get_roots(self, request):
        qs = self.get_queryset().filter(is_root=True).order_by('name')
        serializer = TaxonomyCategoryListSerializer(qs, many=True)
        return Response(serializer.data)


class TaxonomyAttributeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TaxonomyAttribute.objects.all().prefetch_related('values')
    serializer_class = TaxonomyAttributeSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        version_code = self.request.query_params.get('version')
        if version_code:
            qs = qs.filter(taxonomy_version__version_code=version_code)
        else:
            active_version = TaxonomyVersion.objects.filter(is_active=True).first()
            if active_version:
                qs = qs.filter(taxonomy_version=active_version)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(handle__icontains=search))
        return qs
