from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CatalogViewSet

router = DefaultRouter()
router.register(r'', CatalogViewSet, basename='catalog')

urlpatterns = [
    path('', include(router.urls)),
]
