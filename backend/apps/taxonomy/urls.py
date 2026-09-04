from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TaxonomyCategoryViewSet,
    TaxonomyVersionViewSet,
    TaxonomyAttributeViewSet,
)

router = DefaultRouter()
router.register(r'categories', TaxonomyCategoryViewSet, basename='taxonomy-category')
router.register(r'versions', TaxonomyVersionViewSet, basename='taxonomy-version')
router.register(r'attributes', TaxonomyAttributeViewSet, basename='taxonomy-attribute')

urlpatterns = [
    path('', include(router.urls)),
]
