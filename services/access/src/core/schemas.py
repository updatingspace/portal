from datetime import datetime
from typing import Any

from ninja import Schema
from pydantic import field_validator


# =============================================================================
# User Preferences Schemas
# =============================================================================


class AppearanceSettingsSchema(Schema):
    """Schema for appearance settings"""
    theme: str | None = None
    accent_color: str | None = None
    font_size: str | None = None
    high_contrast: bool | None = None
    reduce_motion: bool | None = None

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, v: str | None) -> str | None:
        if v is not None and v not in ("light", "dark", "auto"):
            raise ValueError("theme must be 'light', 'dark', or 'auto'")
        return v

    @field_validator("font_size")
    @classmethod
    def validate_font_size(cls, v: str | None) -> str | None:
        if v is not None and v not in ("small", "medium", "large"):
            raise ValueError("font_size must be 'small', 'medium', or 'large'")
        return v

    @field_validator("accent_color")
    @classmethod
    def validate_accent_color(cls, v: str | None) -> str | None:
        if v is not None:
            import re
            if not re.match(r"^#[0-9A-Fa-f]{6}$", v):
                raise ValueError("accent_color must be a valid hex color (e.g., #007AFF)")
        return v


class LocalizationSettingsSchema(Schema):
    """Schema for localization settings"""
    language: str | None = None
    timezone: str | None = None

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str | None) -> str | None:
        if v is not None and v not in ("en", "ru"):
            raise ValueError("language must be 'en' or 'ru'")
        return v


class PrivacySettingsSchema(Schema):
    """Schema for privacy settings"""
    profile_visibility: str | None = None
    show_online_status: bool | None = None
    show_vote_history: bool | None = None
    share_activity: bool | None = None
    allow_mentions: bool | None = None
    analytics_enabled: bool | None = None
    recommendations_enabled: bool | None = None

    @field_validator("profile_visibility")
    @classmethod
    def validate_profile_visibility(cls, v: str | None) -> str | None:
        if v is not None and v not in ("public", "members", "private"):
            raise ValueError("profile_visibility must be 'public', 'members', or 'private'")
        return v


class UserPreferencesIn(Schema):
    """Schema for updating user preferences (partial update supported)"""
    appearance: AppearanceSettingsSchema | None = None
    localization: LocalizationSettingsSchema | None = None
    notifications: dict[str, Any] | None = None
    privacy: PrivacySettingsSchema | None = None


class UserPreferencesOut(Schema):
    """Schema for user preferences output"""
    id: str
    user_id: str
    tenant_id: str
    appearance: dict[str, Any]
    localization: dict[str, Any]
    notifications: dict[str, Any]
    privacy: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class DefaultPreferencesOut(Schema):
    """Schema for default preferences output"""
    appearance: dict[str, Any]
    localization: dict[str, Any]
    notifications: dict[str, Any]
    privacy: dict[str, Any]


# =============================================================================
# Home Page Modal Schemas
# =============================================================================


class HomePageModalOut(Schema):
    """Schema for homepage modal output"""

    id: int
    title: str
    content: str
    button_text: str
    button_url: str
    modal_type: str
    is_active: bool
    display_once: bool
    start_date: datetime | None
    end_date: datetime | None
    order: int


class HomePageModalIn(Schema):
    """Schema for homepage modal input (admin creation/update)"""

    title: str
    content: str
    button_text: str = "OK"
    button_url: str = ""
    modal_type: str = "info"
    is_active: bool = True
    display_once: bool = False
    start_date: datetime | None = None
    end_date: datetime | None = None
    order: int = 0
