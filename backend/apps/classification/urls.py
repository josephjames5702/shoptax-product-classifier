from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClassificationResultViewSet

router = DefaultRouter()
router.register(r'', ClassificationResultViewSet, basename='classification')

urlpatterns = [
    path('', include(router.urls)),
]
