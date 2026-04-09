import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


INSECURE_DEFAULTS_HINT = (
    "For local debug sessions only, "
    "set DJANGO_ALLOW_INSECURE_DEFAULTS=1."
)
SQLITE_FALLBACK_HINT = (
    "DATABASE_URL must be set. For local debug sessions only, "
    "set DJANGO_ALLOW_SQLITE=1 to use sqlite."
)


def read_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None:
        return default
    value = value.strip()
    return value or default


def read_env_flag(name: str, default: bool = False) -> bool:
    value = read_env(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def read_env_list(name: str) -> list[str]:
    value = read_env(name)
    if value is None:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


DEBUG = read_env_flag("DJANGO_DEBUG", False)
ALLOW_INSECURE_DEFAULTS = DEBUG and read_env_flag(
    "DJANGO_ALLOW_INSECURE_DEFAULTS"
)
ALLOW_SQLITE = DEBUG and read_env_flag("DJANGO_ALLOW_SQLITE")


def require_env(name: str, *, insecure_default: str | None = None) -> str:
    value = read_env(name)
    if value is not None:
        return value
    if ALLOW_INSECURE_DEFAULTS and insecure_default is not None:
        return insecure_default
    raise ImproperlyConfigured(f"{name} must be set. {INSECURE_DEFAULTS_HINT}")


def read_allowed_hosts() -> list[str]:
    hosts = read_env_list("ALLOWED_HOSTS")
    if not hosts:
        if ALLOW_INSECURE_DEFAULTS:
            return ["*"]
        raise ImproperlyConfigured(
            "ALLOWED_HOSTS must be set to a comma-separated "
            "list of allowed hosts."
        )
    if "*" in hosts and not ALLOW_INSECURE_DEFAULTS:
        raise ImproperlyConfigured(
            "ALLOWED_HOSTS cannot contain '*' unless "
            "DJANGO_ALLOW_INSECURE_DEFAULTS=1 in DEBUG mode."
        )
    return hosts


SECRET_KEY = require_env(
    "DJANGO_SECRET_KEY",
    insecure_default="activity-secret",
)
ALLOWED_HOSTS = read_allowed_hosts()

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "activity",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "app.urls"
WSGI_APPLICATION = "app.wsgi.application"

DATABASE_URL = read_env("DATABASE_URL")
if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
        )
    }
elif ALLOW_SQLITE:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    raise ImproperlyConfigured(SQLITE_FALLBACK_HINT)

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = read_env_flag("DJANGO_SECURE_SSL_REDIRECT", not DEBUG)
SECURE_HSTS_SECONDS = int(
    read_env("DJANGO_SECURE_HSTS_SECONDS", "0" if DEBUG else "31536000") or "0"
)
SECURE_HSTS_INCLUDE_SUBDOMAINS = read_env_flag(
    "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS",
    not DEBUG,
)
SECURE_HSTS_PRELOAD = read_env_flag("DJANGO_SECURE_HSTS_PRELOAD", False)
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_SECURE = read_env_flag("DJANGO_SESSION_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = read_env_flag("DJANGO_CSRF_COOKIE_SECURE", not DEBUG)

# Internal HMAC secret for BFF -> service communication
BFF_INTERNAL_HMAC_SECRET = require_env(
    "BFF_INTERNAL_HMAC_SECRET",
    insecure_default="activity-internal-hmac-secret",
)

# Access service URL for RBAC checks
ACCESS_SERVICE_URL = os.getenv("ACCESS_SERVICE_URL", "http://access:8002")

# Steam API configuration
STEAM_API_KEY = os.getenv("STEAM_API_KEY", "")
ACTIVITY_DATA_ENCRYPTION_KEY = require_env(
    "ACTIVITY_DATA_ENCRYPTION_KEY",
    insecure_default=SECRET_KEY,
)
ACTIVITY_DATA_ENCRYPTION_OLD_KEYS = [
    item.strip()
    for item in os.getenv("ACTIVITY_DATA_ENCRYPTION_OLD_KEYS", "").split(",")
    if item.strip()
]
ACTIVITY_RAW_EVENT_RETENTION_DAYS = int(os.getenv("ACTIVITY_RAW_EVENT_RETENTION_DAYS", "7"))

# Data lifecycle / retention defaults
ACTIVITY_RETENTION_RAW_DAYS = int(os.getenv("ACTIVITY_RETENTION_RAW_DAYS", "30"))
ACTIVITY_RETENTION_PROCESSED_OUTBOX_DAYS = int(
    os.getenv("ACTIVITY_RETENTION_PROCESSED_OUTBOX_DAYS", "14")
)
ACTIVITY_RETENTION_AUDIT_DAYS = int(os.getenv("ACTIVITY_RETENTION_AUDIT_DAYS", "365"))

# ============================================================================
# News Media Configuration
# ============================================================================

NEWS_MEDIA_BUCKET = os.getenv("NEWS_MEDIA_BUCKET", "")
NEWS_MEDIA_PREFIX = os.getenv("NEWS_MEDIA_PREFIX", "news")
NEWS_MEDIA_UPLOAD_TTL_SECONDS = int(os.getenv("NEWS_MEDIA_UPLOAD_TTL_SECONDS", "900"))
NEWS_MEDIA_URL_TTL_SECONDS = int(os.getenv("NEWS_MEDIA_URL_TTL_SECONDS", "604800"))
NEWS_MEDIA_MAX_IMAGE_BYTES = int(os.getenv("NEWS_MEDIA_MAX_IMAGE_BYTES", "10485760"))
NEWS_MEDIA_MAX_ATTACHMENTS = int(os.getenv("NEWS_MEDIA_MAX_ATTACHMENTS", "8"))
NEWS_MEDIA_LOCAL_STORAGE_ROOT = os.getenv(
    "NEWS_MEDIA_LOCAL_STORAGE_ROOT",
    "/var/app/news-media",
)
NEWS_MEDIA_LOCAL_PUBLIC_PREFIX = os.getenv(
    "NEWS_MEDIA_LOCAL_PUBLIC_PREFIX",
    "/api/v1/activity",
)

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
