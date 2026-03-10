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


def read_env_alias(
    primary: str,
    *aliases: str,
    default: str | None = None,
) -> str | None:
    for name in (primary, *aliases):
        value = read_env(name)
        if value is not None:
            return value
    return default


def read_env_flag(name: str, default: bool = False) -> bool:
    value = read_env(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def read_env_list(name: str, *aliases: str) -> list[str]:
    value = read_env_alias(name, *aliases)
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
    hosts = read_env_list("ALLOWED_HOSTS", "DJANGO_ALLOWED_HOSTS")
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
    insecure_default="events-secret",
)
ALLOWED_HOSTS = read_allowed_hosts()

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "events",
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
SECURE_REDIRECT_EXEMPT = [
    r"^api/v1/",
    r"^health/?$",
    r"^readiness/?$",
    r"^metrics/?$",
]
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
    insecure_default="events-internal-hmac-secret",
)

# Upstream services
ACCESS_BASE_URL = os.getenv("ACCESS_BASE_URL", "http://access:8002/api/v1")
PORTAL_SERVICE_URL = os.getenv("PORTAL_SERVICE_URL", "http://portal:8003/api/v1")
EVENTS_RETENTION_PUBLISHED_OUTBOX_DAYS = int(
    os.getenv("EVENTS_RETENTION_PUBLISHED_OUTBOX_DAYS", "30")
)
