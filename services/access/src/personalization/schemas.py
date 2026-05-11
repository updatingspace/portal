from __future__ import annotations

import re
from enum import Enum
from typing import Annotated, Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ninja import Schema
from pydantic import Field, field_validator


class ThemeEnum(str, Enum):
    """Available theme options."""
    LIGHT = "light"
    DARK = "dark"
    AUTO = "auto"


class ThemeSourceEnum(str, Enum):
    """Available theme source options."""
    PORTAL = "portal"
    ID = "id"


class LanguageEnum(str, Enum):
    """Supported interface languages."""
    EN = "en"
    RU = "ru"


class FontSizeEnum(str, Enum):
    """Available font size options."""
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"


class ProfileVisibilityEnum(str, Enum):
    """Profile visibility options."""
    PUBLIC = "public"
    MEMBERS = "members"
    PRIVATE = "private"


class EmailDigestEnum(str, Enum):
    """Email digest frequency options."""
    INSTANT = "instant"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"


class NotificationChannelEnum(str, Enum):
    """Notification delivery channels."""
    EMAIL = "email"
    IN_APP = "in_app"
    PUSH = "push"


# Regex for hex color validation
HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")

# Common IANA timezone names for quick validation
COMMON_TIMEZONES = frozenset([
    "UTC", "GMT",
    "Europe/Moscow", "Europe/London", "Europe/Paris", "Europe/Berlin",
    "Europe/Tallinn", "Europe/Helsinki", "Europe/Riga", "Europe/Vilnius",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "America/Toronto", "America/Vancouver", "America/Sao_Paulo",
    "Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore",
    "Asia/Dubai", "Asia/Kolkata", "Asia/Hong_Kong",
    "Australia/Sydney", "Australia/Melbourne", "Australia/Perth",
    "Pacific/Auckland", "Pacific/Honolulu",
    "Africa/Johannesburg", "Africa/Cairo",
])


def validate_timezone(tz: str) -> str:
    """Validate IANA timezone string."""
    if tz in COMMON_TIMEZONES:
        return tz
    try:
        ZoneInfo(tz)
        return tz
    except ZoneInfoNotFoundError:
        raise ValueError(f"Invalid timezone: {tz}")


def validate_hex_color(color: str) -> str:
    """Validate hex color format (#RRGGBB)."""
    if not HEX_COLOR_PATTERN.match(color):
        raise ValueError(f"Invalid hex color format: {color}. Expected #RRGGBB")
    return color.upper()


class NotificationChannelConfigSchema(Schema):
    """Configuration for a notification channel."""
    enabled: bool = True
    channels: list[NotificationChannelEnum] = Field(default_factory=list)

    @field_validator("channels", mode="before")
    @classmethod
    def validate_channels(cls, v: list[str]) -> list[str]:
        valid_channels = {c.value for c in NotificationChannelEnum}
        for channel in v:
            if channel not in valid_channels:
                raise ValueError(f"Invalid channel: {channel}. Valid: {valid_channels}")
        return v


class EmailChannelSchema(Schema):
    """Email notification channel settings."""
    enabled: bool = True
    digest: EmailDigestEnum = EmailDigestEnum.INSTANT


class InAppChannelSchema(Schema):
    """In-app notification channel settings."""
    enabled: bool = True


class PushChannelSchema(Schema):
    """Push notification channel settings (MVP: disabled)."""
    enabled: bool = False


class QuietHoursSchema(Schema):
    """Quiet hours configuration for notifications."""
    enabled: bool = False
    start: str = "22:00"  # HH:MM format
    end: str = "08:00"

    @field_validator("start", "end", mode="before")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        if not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", v):
            raise ValueError(f"Invalid time format: {v}. Expected HH:MM (24h)")
        return v


class NotificationSettingsSchema(Schema):
    """Full notification settings structure."""
    email: EmailChannelSchema = Field(default_factory=EmailChannelSchema)
    in_app: InAppChannelSchema = Field(default_factory=InAppChannelSchema)
    push: PushChannelSchema = Field(default_factory=PushChannelSchema)
    types: dict[str, Any] = Field(default_factory=dict)
    quiet_hours: QuietHoursSchema = Field(default_factory=QuietHoursSchema)


class AppearanceSchema(Schema):
    """User appearance/theme preferences."""
    theme: ThemeEnum = ThemeEnum.AUTO
    theme_source: ThemeSourceEnum = ThemeSourceEnum.PORTAL
    accent_color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")] = "#8B5CF6"
    font_size: FontSizeEnum = FontSizeEnum.MEDIUM
    high_contrast: bool = False
    reduce_motion: bool = False

    @field_validator("accent_color", mode="before")
    @classmethod
    def normalize_color(cls, v: str) -> str:
        return validate_hex_color(v)


class LocalizationSchema(Schema):
    """User localization preferences."""
    language: LanguageEnum = LanguageEnum.EN
    timezone: str = "UTC"

    @field_validator("timezone", mode="before")
    @classmethod
    def validate_tz(cls, v: str) -> str:
        return validate_timezone(v)


class PrivacySchema(Schema):
    """User privacy preferences."""
    profile_visibility: ProfileVisibilityEnum = ProfileVisibilityEnum.MEMBERS
    show_online_status: bool = True
    show_vote_history: bool = False
    share_activity: bool = True
    allow_mentions: bool = True
    analytics_enabled: bool = True
    recommendations_enabled: bool = True


class UserPreferenceSchema(Schema):
    """Full user preference response schema."""

    id: UUID
    user_id: UUID
    tenant_id: UUID
    appearance: AppearanceSchema
    localization: LocalizationSchema
    notifications: dict[str, Any]
    privacy: PrivacySchema
    created_at: str
    updated_at: str


class UserPreferenceUpdateSchema(Schema):
    """Schema for updating user preferences (partial updates supported)."""

    appearance: AppearanceSchema | None = None
    localization: LocalizationSchema | None = None
    notifications: dict[str, Any] | None = None
    privacy: PrivacySchema | None = None


class UserPreferenceDefaultsSchema(Schema):
    """Schema for default preferences response."""

    appearance: AppearanceSchema
    localization: LocalizationSchema
    notifications: NotificationSettingsSchema
    privacy: PrivacySchema
