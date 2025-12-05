import os
from pathlib import Path

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


def read_secret(name: str, default: str | None = None) -> str:
    file_path = os.getenv(f"{name}_FILE")
    if file_path:
        try:
            value = Path(file_path).read_text().strip()
            if value:
                return value
        except OSError:
            # Fall back to environment/default when the secret file is missing in dev
            pass

    env_value = os.getenv(name)
    if env_value:
        return env_value

    if default is not None:
        return default

    raise RuntimeError(f"{name} is not configured")


SECRET_KEY = read_secret(
    "DJANGO_SECRET_KEY",
    "django-insecure-5=c$9_ezm-tl26th0n5#)%e+j2m=&encv3!2f0ng53#gbzgb4#",
)

DEBUG = read_env_flag("DJANGO_DEBUG", False)

ALLOWED_HOSTS = read_env_list("DJANGO_ALLOWED_HOSTS", ["*"])
CSRF_TRUSTED_ORIGINS = read_env_list("DJANGO_CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "corsheaders",
    "core",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.usersessions",
    "allauth.mfa",
    "allauth.headless",
    "ninja_jwt",
    "ninja_jwt.token_blacklist",
    "accounts",
    "nominations",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "aef_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "aef_backend.wsgi.application"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "ru"

TIME_ZONE = "Europe/Moscow"

USE_I18N = True

USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SITE_ID = int(os.getenv("DJANGO_SITE_ID", "1"))

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

ACCOUNT_LOGIN_METHODS = {"username", "email"}
ACCOUNT_USERNAME_REQUIRED = True
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_EMAIL_VERIFICATION = "none"
ACCOUNT_SESSION_REMEMBER = True
ALLAUTH_MFA_WEBAUTHN_ALLOW_INSECURE_ORIGIN = read_env_flag(
    "ALLAUTH_MFA_WEBAUTHN_ALLOW_INSECURE_ORIGIN", DEBUG
)
# allauth-mfa config for passkeys/local dev
MFA_ADAPTER = "accounts.mfa_adapter.CustomMFAAdapter"
MFA_SUPPORTED_TYPES = ["recovery_codes", "totp", "webauthn"]
MFA_WEBAUTHN_ALLOW_INSECURE_ORIGIN = read_env_flag(
    "MFA_WEBAUTHN_ALLOW_INSECURE_ORIGIN", DEBUG
)
MFA_PASSKEY_LOGIN_ENABLED = True
MFA_PASSKEY_SIGNUP_ENABLED = False
MFA_WEBAUTHN_RP_ID = read_env("MFA_WEBAUTHN_RP_ID", "localhost")
MFA_WEBAUTHN_RP_NAME = read_env("MFA_WEBAUTHN_RP_NAME", "AEF Vote")

CORS_ALLOWED_ORIGINS = read_env_list(
    "CORS_ALLOWED_ORIGINS",
    [],
)
CORS_ALLOW_CREDENTIALS = True
try:
    from corsheaders.defaults import default_headers

    CORS_ALLOW_HEADERS = list(default_headers) + ["X-Session-Token"]
except Exception:
    CORS_ALLOW_HEADERS = [
        "accept",
        "accept-language",
        "content-language",
        "content-type",
        "origin",
        "authorization",
        "x-requested-with",
        "x-session-token",
    ]

TELEGRAM_BOT_TOKEN = read_secret("TELEGRAM_BOT_TOKEN", "")
try:
    TELEGRAM_LOGIN_MAX_AGE = int(os.getenv("TELEGRAM_LOGIN_MAX_AGE", "86400"))
except ValueError:
    TELEGRAM_LOGIN_MAX_AGE = 86400
TELEGRAM_REQUIRE_LINK_FOR_VOTING = read_env_flag(
    "TELEGRAM_REQUIRE_LINK_FOR_VOTING",
    False,
)
TELEGRAM_ADMIN_IDS: list[int] = []
for raw_value in read_env_list("TELEGRAM_ADMIN_IDS", []):
    try:
        TELEGRAM_ADMIN_IDS.append(int(raw_value))
    except (TypeError, ValueError):
        # Игнорируем нечисловые значения, чтобы не ломать загрузку настроек
        continue

HEADLESS_TOKEN_STRATEGY = "allauth.headless.tokens.sessions.SessionTokenStrategy"

NINJA_JWT = {
    "TOKEN_BLACKLIST_ENABLED": True,
}

APP_LOG_LEVEL = os.getenv("DJANGO_LOG_LEVEL", "INFO").upper()

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        }
    },
    "root": {
        "handlers": ["console"],
        "level": APP_LOG_LEVEL,
    },
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.security": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}
