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
    content_html: str
    button_text: str
    button_url: str
    modal_type: str
    is_active: bool
    display_once: bool
    start_date: datetime | None
    end_date: datetime | None
    order: int
    translations: dict[str, Any]
    version: int
    deleted_at: datetime | None
    created_by: str | None
    updated_by: str | None
    created_at: datetime
    updated_at: datetime


class HomePageModalListOut(Schema):
    """Lightweight schema for modal list (table view)"""

    id: int
    title: str
    modal_type: str
    is_active: bool
    start_date: datetime | None
    end_date: datetime | None
    order: int
    version: int
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime


class HomePageModalIn(Schema):
    """Schema for homepage modal input (admin creation/update)"""

    title: str
    content: str
    content_html: str = ""
    button_text: str = "OK"
    button_url: str = ""
    modal_type: str = "info"
    is_active: bool = True
    display_once: bool = False
    start_date: datetime | None = None
    end_date: datetime | None = None
    order: int = 0
    translations: dict[str, Any] | None = None

    @field_validator("modal_type")
    @classmethod
    def validate_modal_type(cls, v: str) -> str:
        if v not in ("info", "warning", "success", "promo"):
            raise ValueError("modal_type must be 'info', 'warning', 'success', or 'promo'")
        return v

    @field_validator("end_date")
    @classmethod
    def validate_end_date(cls, v: datetime | None, info) -> datetime | None:
        if v is not None:
            start_date = info.data.get("start_date")
            if start_date and v < start_date:
                raise ValueError("end_date must be after start_date")
        return v


class HomePageModalBulkAction(Schema):
    """Schema for bulk actions on modals"""
    modal_ids: list[int]
    action: str  # "activate", "deactivate", "delete", "restore"

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        if v not in ("activate", "deactivate", "delete", "restore"):
            raise ValueError("action must be 'activate', 'deactivate', 'delete', or 'restore'")
        return v


class ModalListFilters(Schema):
    """Schema for modal list filtering"""
    include_deleted: bool = False
    is_active: bool | None = None
    modal_type: str | None = None
    search: str | None = None
    start_date_from: datetime | None = None
    start_date_to: datetime | None = None


# =============================================================================
# Content Widget Schemas
# =============================================================================


class ContentWidgetOut(Schema):
    """Schema for content widget output"""
    id: str
    tenant_id: str
    name: str
    widget_type: str
    placement: str
    content: dict[str, Any]
    is_active: bool
    start_date: datetime | None
    end_date: datetime | None
    priority: int
    target_pages: list[str]
    target_roles: list[str]
    deleted_at: datetime | None
    created_by: str | None
    updated_by: str | None
    created_at: datetime
    updated_at: datetime


class ContentWidgetIn(Schema):
    """Schema for content widget input"""
    name: str
    widget_type: str = "banner"
    placement: str = "top"
    content: dict[str, Any] = {}
    is_active: bool = True
    start_date: datetime | None = None
    end_date: datetime | None = None
    priority: int = 0
    target_pages: list[str] = []
    target_roles: list[str] = []

    @field_validator("widget_type")
    @classmethod
    def validate_widget_type(cls, v: str) -> str:
        if v not in ("banner", "announcement", "promotion", "notification"):
            raise ValueError("widget_type must be 'banner', 'announcement', 'promotion', or 'notification'")
        return v

    @field_validator("placement")
    @classmethod
    def validate_placement(cls, v: str) -> str:
        if v not in ("top", "bottom", "sidebar", "inline"):
            raise ValueError("placement must be 'top', 'bottom', 'sidebar', or 'inline'")
        return v


# =============================================================================
# Modal Analytics Schemas
# =============================================================================


class AnalyticsEventIn(Schema):
    """Schema for tracking analytics events"""
    modal_id: int
    event_type: str
    session_id: str = ""
    metadata: dict[str, Any] = {}

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        if v not in ("view", "click", "dismiss"):
            raise ValueError("event_type must be 'view', 'click', or 'dismiss'")
        return v


class ModalAnalyticsOut(Schema):
    """Schema for modal analytics output"""
    modal_id: int
    modal_title: str
    total_views: int
    total_clicks: int
    total_dismissals: int
    click_through_rate: float  # clicks / views * 100


class AnalyticsReportOut(Schema):
    """Schema for analytics report"""
    period_start: datetime
    period_end: datetime
    total_modals: int
    total_views: int
    total_clicks: int
    total_dismissals: int
    average_ctr: float
    modals: list[ModalAnalyticsOut]
