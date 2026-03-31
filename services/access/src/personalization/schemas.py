from __future__ import annotations

from typing import Any
from uuid import UUID

from ninja import Schema


class NotificationChannelsSchema(Schema):
    enabled: bool
    channels: list[str]


class NotificationTypesSchema(Schema):
    polls: dict[str, NotificationChannelsSchema] = {
        "new_vote": {"enabled": True, "channels": ["email", "in_app"]},
        "closing_soon": {"enabled": True, "channels": ["email", "in_app"]},
        "results_published": {"enabled": False, "channels": []},
    }
    events: dict[str, NotificationChannelsSchema] = {
        "new_event": {"enabled": True, "channels": ["email", "in_app"]},
        "rsvp_reminder": {"enabled": True, "channels": ["email", "in_app"]},
        "event_starting": {"enabled": True, "channels": ["email", "in_app"]},
    }
    community: dict[str, NotificationChannelsSchema] = {
        "new_member": {"enabled": False, "channels": []},
        "post_flagged": {"enabled": True, "channels": ["email", "in_app"]},
        "mention": {"enabled": True, "channels": ["email", "in_app"]},
    }
    system: dict[str, NotificationChannelsSchema] = {
        "security_alert": {"enabled": True, "channels": ["email", "in_app"]},
        "product_update": {"enabled": True, "channels": ["in_app"]},
    }


class NotificationSettingsSchema(Schema):
    email: dict[str, Any] = {"enabled": True, "digest": "instant"}
    in_app: dict[str, bool] = {"enabled": True}
    push: dict[str, bool] = {"enabled": False}
    types: dict[str, Any] = {}
    quiet_hours: dict[str, Any] = {"enabled": False, "start": "22:00", "end": "08:00"}


class AppearanceSchema(Schema):
    theme: str = "auto"
    accent_color: str = "#8B5CF6"
    font_size: str = "medium"
    high_contrast: bool = False
    reduce_motion: bool = False


class LocalizationSchema(Schema):
    language: str = "en"
    timezone: str = "UTC"


class PrivacySchema(Schema):
    profile_visibility: str = "members"
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
