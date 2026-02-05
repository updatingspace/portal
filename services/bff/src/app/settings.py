import os
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

def read_env_flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}

def read_env_list(name: str, default: list[str] | None = None) -> list[str]:
    value = os.getenv(name)
    if value is None:
        return default or []
    return [item.strip() for item in value.split(",") if item.strip()]

def read_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None:
        return default
    return value

SECRET_KEY = read_env("DJANGO_SECRET_KEY", "insects-are-everywhere-bff")

DEBUG = read_env_flag("DJANGO_DEBUG", False)

ALLOWED_HOSTS = read_env_list("DJANGO_ALLOWED_HOSTS", ["*"]) # In Docker, usually * or specific hostnames for bff

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
    "bff.middleware.ErrorMappingMiddleware",
    "bff.middleware.TenantResolveMiddleware",
    "bff.middleware.CookieSessionAuthMiddleware",
    "bff.middleware.SessionRateLimitMiddleware",
    "bff.middleware.DoubleSubmitCsrfMiddleware",
    # "django.middleware.csrf.CsrfViewMiddleware", # DoubleSubmitCsrfMiddleware replaces this? Check BFF implementation.
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

BFF_SESSION_DB_FALLBACK = read_env_flag("BFF_SESSION_DB_FALLBACK", False)
BFF_INTERNAL_HMAC_SECRET = read_env("BFF_INTERNAL_HMAC_SECRET", "")
BFF_UPDSPACEID_CALLBACK_SECRET = read_env("BFF_UPDSPACEID_CALLBACK_SECRET", "")

BFF_UPSTREAM_PORTAL_URL = read_env("BFF_UPSTREAM_PORTAL_URL", "")
BFF_UPSTREAM_VOTING_URL = read_env("BFF_UPSTREAM_VOTING_URL", "")
BFF_UPSTREAM_EVENTS_URL = read_env("BFF_UPSTREAM_EVENTS_URL", "")
BFF_UPSTREAM_FEED_URL = read_env("BFF_UPSTREAM_FEED_URL", "")
BFF_UPSTREAM_GAMIFICATION_URL = read_env("BFF_UPSTREAM_GAMIFICATION_URL", "")
BFF_UPSTREAM_ID_URL = read_env("ID_BASE_URL", "")
ID_PUBLIC_BASE_URL = read_env("ID_PUBLIC_BASE_URL", "")
BFF_UPSTREAM_ACCESS_URL = read_env("ACCESS_BASE_URL", "")

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
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.config(default=DATABASE_URL, conn_max_age=600)
    }
else:
    # Default to sqlite if no env, but plan says prefer postgres.
    # We will use sqlite for simple local run if no env provided, to not crash as per D2.
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


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
