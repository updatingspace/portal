import os
from pathlib import Path
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "events-secret")
DEBUG = os.getenv("DJANGO_DEBUG") == "True"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "events",
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

# Upstream services
ACCESS_BASE_URL = os.getenv("ACCESS_BASE_URL", "http://access:8002/api/v1")
PORTAL_SERVICE_URL = os.getenv("PORTAL_SERVICE_URL", "http://portal:8003/api/v1")
