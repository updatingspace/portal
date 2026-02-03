import os
from pathlib import Path
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "activity-secret")
DEBUG = os.getenv("DJANGO_DEBUG") == "True"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "activity",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "app.urls"
WSGI_APPLICATION = "app.wsgi.application"

DATABASES = {
    "default": dj_database_url.config(default="sqlite:///db.sqlite3", conn_max_age=600)
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Internal HMAC secret for BFF -> service communication
BFF_INTERNAL_HMAC_SECRET = os.getenv("BFF_INTERNAL_HMAC_SECRET", "")

# Access service URL for RBAC checks
ACCESS_SERVICE_URL = os.getenv("ACCESS_SERVICE_URL", "http://access:8002")

# Steam API configuration
STEAM_API_KEY = os.getenv("STEAM_API_KEY", "")

# ============================================================================
# News Media (S3) Configuration
# ============================================================================

NEWS_MEDIA_BUCKET = os.getenv("NEWS_MEDIA_BUCKET", "")
NEWS_MEDIA_PREFIX = os.getenv("NEWS_MEDIA_PREFIX", "news")
NEWS_MEDIA_UPLOAD_TTL_SECONDS = int(os.getenv("NEWS_MEDIA_UPLOAD_TTL_SECONDS", "900"))
NEWS_MEDIA_URL_TTL_SECONDS = int(os.getenv("NEWS_MEDIA_URL_TTL_SECONDS", "604800"))
NEWS_MEDIA_MAX_IMAGE_BYTES = int(os.getenv("NEWS_MEDIA_MAX_IMAGE_BYTES", "10485760"))
NEWS_MEDIA_MAX_ATTACHMENTS = int(os.getenv("NEWS_MEDIA_MAX_ATTACHMENTS", "8"))

S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "")
S3_REGION = os.getenv("S3_REGION", "")
S3_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY_ID", "")
S3_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_ACCESS_KEY", "")
S3_FORCE_PATH_STYLE = os.getenv("S3_FORCE_PATH_STYLE", "0") in {"1", "true", "yes", "on"}

# ============================================================================
# Structured Logging Configuration
# ============================================================================

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "activity.logging_config.JsonFormatter",
        },
        "verbose": {
            "format": "{levelname} {asctime} {name} {module} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json" if not DEBUG else "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": LOG_LEVEL,
    },
    "loggers": {
        "activity": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        "django": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "httpx": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}
