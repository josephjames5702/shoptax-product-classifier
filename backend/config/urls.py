"""
Main URL Configuration for the Taxonomy Classification API.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from .views import health_check

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health-check'),
    path('api/auth/', include('apps.users.urls')),
    path('api/catalogs/', include('apps.catalogs.urls')),
    path('api/products/', include('apps.products.urls')),
    path('api/taxonomy/', include('apps.taxonomy.urls')),
    path('api/classifications/', include('apps.classification.urls')),
    path('api/reviews/', include('apps.reviews.urls')),
    path('api/jobs/', include('apps.jobs.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
