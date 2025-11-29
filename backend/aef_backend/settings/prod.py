from .base import *

DEBUG = read_env_flag("DJANGO_DEBUG", False)

ALLOWED_HOSTS = read_env_list("DJANGO_ALLOWED_HOSTS", [])
CSRF_TRUSTED_ORIGINS = read_env_list("DJANGO_CSRF_TRUSTED_ORIGINS")
CORS_ALLOWED_ORIGINS = read_env_list("CORS_ALLOWED_ORIGINS")

postgres_host = read_env("POSTGRES_HOST")

if not postgres_host:
    raise RuntimeError("POSTGRES_HOST is required for production settings")

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": read_env("POSTGRES_DB", "postgres"),
        "USER": read_env("POSTGRES_USER", "postgres"),
        "PASSWORD": read_secret("POSTGRES_PASSWORD"),
        "HOST": postgres_host,
        "PORT": read_env("POSTGRES_PORT", "5432"),
    }
}

STATIC_ROOT = BASE_DIR / "staticfiles"
