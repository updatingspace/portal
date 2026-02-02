"""
Standardized error codes and i18n support for Activity service.

Provides:
- Centralized error code definitions
- Translatable error messages
- Language detection from user profile
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ErrorCode:
    """Standardized error code definition."""

    code: str
    message_en: str
    message_ru: str

    def get_message(self, lang: str = "en") -> str:
        """Get message in specified language."""
        if lang == "ru":
            return self.message_ru
        return self.message_en


# ============================================================================
# Error Code Registry
# ============================================================================


class ErrorCodes:
    """Registry of all Activity service error codes."""

    # Authentication/Authorization
    UNAUTHORIZED = ErrorCode(
        code="UNAUTHORIZED",
        message_en="Authentication required",
        message_ru="Требуется аутентификация",
    )

    ACCESS_DENIED = ErrorCode(
        code="ACCESS_DENIED",
        message_en="Access denied",
        message_ru="Доступ запрещен",
    )

    SUSPENDED_USER = ErrorCode(
        code="SUSPENDED_USER",
        message_en="Your account is suspended",
        message_ru="Ваш аккаунт заблокирован",
    )

    ADMIN_ONLY = ErrorCode(
        code="ADMIN_ONLY",
        message_en="This feature is restricted to administrators",
        message_ru="Эта функция доступна только администраторам",
    )

    # Validation
    INVALID_CURSOR = ErrorCode(
        code="INVALID_CURSOR",
        message_en="Invalid pagination cursor",
        message_ru="Недействительный курсор пагинации",
    )

    INVALID_EVENT_TYPES = ErrorCode(
        code="INVALID_EVENT_TYPES",
        message_en="Unsupported event types requested",
        message_ru="Запрошены неподдерживаемые типы событий",
    )

    INVALID_FROM = ErrorCode(
        code="INVALID_FROM",
        message_en="Invalid 'from' datetime format",
        message_ru="Неверный формат даты 'from'",
    )

    INVALID_TO = ErrorCode(
        code="INVALID_TO",
        message_en="Invalid 'to' datetime format",
        message_ru="Неверный формат даты 'to'",
    )

    INVALID_TENANT_ID = ErrorCode(
        code="INVALID_TENANT_ID",
        message_en="X-Tenant-Id must be a valid UUID",
        message_ru="X-Tenant-Id должен быть корректным UUID",
    )

    INVALID_USER_ID = ErrorCode(
        code="INVALID_USER_ID",
        message_en="X-User-Id must be a valid UUID",
        message_ru="X-User-Id должен быть корректным UUID",
    )

    # Resources
    SOURCE_NOT_FOUND = ErrorCode(
        code="SOURCE_NOT_FOUND",
        message_en="Source not found",
        message_ru="Источник не найден",
    )

    ACCOUNT_LINK_NOT_FOUND = ErrorCode(
        code="ACCOUNT_LINK_NOT_FOUND",
        message_en="Account link not found",
        message_ru="Связь с аккаунтом не найдена",
    )

    GAME_NOT_FOUND = ErrorCode(
        code="GAME_NOT_FOUND",
        message_en="Game not found",
        message_ru="Игра не найдена",
    )

    # Connector errors
    STEAM_API_ERROR = ErrorCode(
        code="STEAM_API_ERROR",
        message_en="Failed to communicate with Steam API",
        message_ru="Ошибка связи с Steam API",
    )

    STEAM_PRIVATE_PROFILE = ErrorCode(
        code="STEAM_PRIVATE_PROFILE",
        message_en="Steam profile is private. Please make game details public.",
        message_ru="Профиль Steam приватный. Пожалуйста, сделайте информацию об играх публичной.",
    )

    MINECRAFT_WEBHOOK_ERROR = ErrorCode(
        code="MINECRAFT_WEBHOOK_ERROR",
        message_en="Minecraft webhook verification failed",
        message_ru="Ошибка проверки вебхука Minecraft",
    )

    # Sync errors
    SYNC_FAILED = ErrorCode(
        code="SYNC_FAILED",
        message_en="Synchronization failed",
        message_ru="Синхронизация не удалась",
    )

    SYNC_NO_CONNECTOR = ErrorCode(
        code="SYNC_NO_CONNECTOR",
        message_en="No connector found for this source type",
        message_ru="Для данного типа источника нет коннектора",
    )

    # Internal errors
    INTERNAL_ERROR = ErrorCode(
        code="INTERNAL_ERROR",
        message_en="Internal server error",
        message_ru="Внутренняя ошибка сервера",
    )

    HMAC_CONFIG_ERROR = ErrorCode(
        code="HMAC_CONFIG_ERROR",
        message_en="Internal HMAC secret is not configured",
        message_ru="Внутренний HMAC-ключ не настроен",
    )


def localized_error_payload(
    error: ErrorCode,
    lang: str = "en",
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Create a localized error payload.

    Args:
        error: ErrorCode instance
        lang: Language code ("en" or "ru")
        details: Optional error details

    Returns:
        Error payload dict for HttpError
    """
    return {
        "code": error.code,
        "message": error.get_message(lang),
        "details": details or {},
    }


def get_preferred_language(request) -> str:
    """
    Get user's preferred language from request headers.

    Priority:
    1. X-Preferred-Language header (set by BFF from user profile)
    2. Accept-Language header (browser preference)
    3. Default to "en"

    Args:
        request: Django request object

    Returns:
        Language code ("en" or "ru")
    """
    # Check custom header (set by BFF from user profile)
    preferred = request.headers.get("X-Preferred-Language", "").lower()
    if preferred in ("ru", "ru-ru"):
        return "ru"

    # Check Accept-Language header
    accept_lang = request.headers.get("Accept-Language", "").lower()
    if "ru" in accept_lang:
        return "ru"

    return "en"
