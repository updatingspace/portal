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
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


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
    insecure_default="insects-are-everywhere-bff",
)

ALLOWED_HOSTS = read_allowed_hosts()

INSTALLED_APPS = [
    # "django.contrib.admin", # Admin not needed for BFF ideally, unless we want to view sessions
    # "django.contrib.auth",  # BFF doesn't do auth, it acts as session holder. But SessionStore might use it if fallback.
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "bff",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "bff.middleware.RequestIdMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "bff.middleware.ErrorMappingMiddleware",
    "bff.middleware.TenantResolveMiddleware",
    "bff.middleware.CookieSessionAuthMiddleware",
    "bff.middleware.SessionRateLimitMiddleware",
    # "django.contrib.auth.middleware.AuthenticationMiddleware", # Not using Django Auth
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# --- BFF Settings ---
BFF_TENANT_HOST_SUFFIX = read_env("BFF_TENANT_HOST_SUFFIX", "updspace.com")
BFF_TENANT_API_PREFIX = read_env("BFF_TENANT_API_PREFIX", "api")
BFF_DEV_AUTO_TENANT = read_env_flag("BFF_DEV_AUTO_TENANT", False)
BFF_COOKIE_DOMAIN = read_env("BFF_COOKIE_DOMAIN")
if BFF_COOKIE_DOMAIN is None and not DEBUG:
    suffix = str(BFF_TENANT_HOST_SUFFIX or "updspace.com").lstrip(".").strip()
    BFF_COOKIE_DOMAIN = f".{suffix}" if suffix else None

BFF_COOKIE_SAMESITE = read_env("BFF_COOKIE_SAMESITE", "Lax")
BFF_SESSION_COOKIE_NAME = read_env("BFF_SESSION_COOKIE_NAME", "updspace_session")
BFF_CSRF_COOKIE_NAME = read_env("BFF_CSRF_COOKIE_NAME", "updspace_csrf")
BFF_CSRF_HEADER = read_env("BFF_CSRF_HEADER", "HTTP_X_CSRF_TOKEN")
BFF_CSRF_COOKIE_DOMAIN = read_env("BFF_CSRF_COOKIE_DOMAIN")

CSRF_COOKIE_NAME = BFF_CSRF_COOKIE_NAME
CSRF_HEADER_NAME = BFF_CSRF_HEADER
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = BFF_COOKIE_SAMESITE
CSRF_COOKIE_DOMAIN = BFF_CSRF_COOKIE_DOMAIN
CSRF_COOKIE_PATH = "/"
CSRF_COOKIE_HTTPONLY = False
CSRF_FAILURE_VIEW = "bff.csrf.csrf_failure"

BFF_SESSION_DB_FALLBACK = read_env_flag("BFF_SESSION_DB_FALLBACK", False)
BFF_INTERNAL_HMAC_SECRET = require_env(
    "BFF_INTERNAL_HMAC_SECRET",
    insecure_default="bff-internal-hmac-secret",
)
BFF_UPDSPACEID_CALLBACK_SECRET = require_env(
    "BFF_UPDSPACEID_CALLBACK_SECRET",
    insecure_default="bff-callback-secret",
)

BFF_UPSTREAM_PORTAL_URL = read_env("BFF_UPSTREAM_PORTAL_URL", "")
BFF_UPSTREAM_VOTING_URL = read_env("BFF_UPSTREAM_VOTING_URL", "")
BFF_UPSTREAM_EVENTS_URL = read_env("BFF_UPSTREAM_EVENTS_URL", "")
BFF_UPSTREAM_FEED_URL = read_env("BFF_UPSTREAM_FEED_URL", "")
BFF_UPSTREAM_GAMIFICATION_URL = read_env("BFF_UPSTREAM_GAMIFICATION_URL", "")
BFF_UPSTREAM_FEATUREFLAGS_URL = read_env("BFF_UPSTREAM_FEATUREFLAGS_URL", "")
BFF_UPSTREAM_ID_URL = read_env("ID_BASE_URL", "")
ID_PUBLIC_BASE_URL = read_env("ID_PUBLIC_BASE_URL", "")
BFF_UPSTREAM_ACCESS_URL = read_env("ACCESS_BASE_URL", "")
BFF_RETENTION_SESSION_DAYS = int(os.getenv("BFF_RETENTION_SESSION_DAYS", "30"))
BFF_RETENTION_AUDIT_DAYS = int(os.getenv("BFF_RETENTION_AUDIT_DAYS", "365"))

# OIDC settings for login via ID.UpdSpace
BFF_OIDC_CLIENT_ID = read_env("BFF_OIDC_CLIENT_ID", "")
BFF_OIDC_CLIENT_SECRET = read_env("BFF_OIDC_CLIENT_SECRET", "")
BFF_OIDC_AUTHORIZE_URL = read_env("BFF_OIDC_AUTHORIZE_URL", "")  # Override if authorize URL differs from ID_PUBLIC_BASE_URL/authorize

try:
    BFF_SESSION_RATE_LIMIT_PER_MIN = int(os.getenv("BFF_SESSION_RATE_LIMIT_PER_MIN", "60"))
except ValueError:
    BFF_SESSION_RATE_LIMIT_PER_MIN = 60

try:
    BFF_PROXY_TIMEOUT_SECONDS = float(os.getenv("BFF_PROXY_TIMEOUT_SECONDS", "10"))
except ValueError:
    BFF_PROXY_TIMEOUT_SECONDS = 10.0

ROOT_URLCONF = "app.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "app.wsgi.application"

# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases
# Use separate DB for BFF Sessions
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


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators
AUTH_PASSWORD_VALIDATORS = []

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"

# Default primary key field type
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

# Cache for Sessions
REDIS_URL = os.getenv("REDIS_URL")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
            }
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "django.utils.log.ServerFormatter", # Simplified
            "format": "[{server_time}] {levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": os.getenv("LOG_LEVEL", "INFO"),
    },
}
