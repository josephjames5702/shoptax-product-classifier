"""
Django settings for Shopify Taxonomy Classifier project.
Configured for MariaDB, Celery, Redis, and Django REST Framework.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env if present
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-taxonomy-classifier-prod-key-2026-xyz')

DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'corsheaders',
    'rest_framework',
    # Local Apps
    'apps.users',
    'apps.catalogs',
    'apps.products',
    'apps.taxonomy',
    'apps.classification',
    'apps.reviews',
    'apps.jobs',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# Database Configuration: MariaDB / MySQL or SQLite
DB_ENGINE = os.environ.get('DB_ENGINE', 'sqlite').lower()

if DB_ENGINE in ('mariadb', 'mysql'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': os.environ.get('DB_NAME', 'taxonomy_db'),
            'USER': os.environ.get('DB_USER', 'root'),
            'PASSWORD': os.environ.get('DB_PASSWORD', 'rootpassword'),
            'HOST': os.environ.get('DB_HOST', '127.0.0.1'),
            'PORT': os.environ.get('DB_PORT', '3306'),
            'OPTIONS': {
                'charset': 'utf8mb4',
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            },
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
            'OPTIONS': {
                'timeout': 60,
            }
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS Configuration
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
CORS_ALLOWED_ORIGINS = [
    FRONTEND_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]
CORS_ALLOW_ALL_ORIGINS = True # Allow easy local dev
CORS_ALLOW_CREDENTIALS = True

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'config.authentication.CsrfExemptSessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 25,
    'PAGE_SIZE_QUERY_PARAM': 'page_size',
    'MAX_PAGE_SIZE': 500,
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.MultiPartParser',
        'rest_framework.parsers.FormParser',
    ],
}

# Celery & Redis Broker Configuration
CELERY_BROKER_URL = os.getenv('REDIS_URL', 'memory://')
# Run Celery tasks eagerly (synchronously) for development without a broker
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Classification Pipeline & AI Configuration
CLASSIFICATION_BATCH_SIZE = int(os.environ.get('CLASSIFICATION_BATCH_SIZE', '50'))
MAX_AI_CONCURRENCY = int(os.environ.get('MAX_AI_CONCURRENCY', '10'))
IMAGE_TIMEOUT_SECONDS = int(os.environ.get('IMAGE_TIMEOUT_SECONDS', '10'))
AI_TIMEOUT_SECONDS = int(os.environ.get('AI_TIMEOUT_SECONDS', '45'))
MAX_RETRIES = int(os.environ.get('MAX_RETRIES', '3'))

# AI Provider Settings
CLASSIFIER_PROVIDER = os.environ.get('CLASSIFIER_PROVIDER', 'hybrid_heuristic')
TAXONOMY_VERSION = os.environ.get('TAXONOMY_VERSION', '2026-08')
AI_API_KEY = os.environ.get('AI_API_KEY', '')
AI_MODEL = os.environ.get('AI_MODEL', 'gemini-1.5-flash')

# Multi-Signal Confidence Weights
CONFIDENCE_WEIGHTS = {
    'semantic_similarity': float(os.environ.get('WEIGHT_SEMANTIC', '0.25')),
    'lexical_match': float(os.environ.get('WEIGHT_LEXICAL', '0.15')),
    'hierarchical_consistency': float(os.environ.get('WEIGHT_HIERARCHY', '0.15')),
    'llm_reranker_score': float(os.environ.get('WEIGHT_LLM', '0.20')),
    'attribute_consistency': float(os.environ.get('WEIGHT_ATTRIBUTE', '0.10')),
    'image_evidence': float(os.environ.get('WEIGHT_IMAGE', '0.10')),
    'data_completeness': float(os.environ.get('WEIGHT_COMPLETENESS', '0.05')),
}
