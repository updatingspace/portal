from .base import *

DEBUG = read_env_flag("DJANGO_DEBUG", True)

ALLOWED_HOSTS = read_env_list("DJANGO_ALLOWED_HOSTS", ["*"])
CSRF_TRUSTED_ORIGINS = read_env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    ["http://localhost:5173", "http://frontend:5173"],
)
CORS_ALLOWED_ORIGINS = read_env_list(
    "CORS_ALLOWED_ORIGINS",
    ["http://localhost:5173", "http://frontend:5173"],
)

postgres_host = read_env("POSTGRES_HOST")

if postgres_host:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": read_env("POSTGRES_DB", "postgres"),
            "USER": read_env("POSTGRES_USER", "postgres"),
            "PASSWORD": read_secret("POSTGRES_PASSWORD", "postgres"),
            "HOST": postgres_host,
            "PORT": read_env("POSTGRES_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

if read_env_flag("ENABLE_DEBUG_TOOLBAR", False):
    try:
        import debug_toolbar  # type: ignore

        INSTALLED_APPS += ["debug_toolbar"]
        MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")
        INTERNAL_IPS = ["127.0.0.1", "localhost"]
    except ImportError:
        # Debug toolbar is optional; skip when not installed
        pass
