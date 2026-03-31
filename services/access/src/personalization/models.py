from __future__ import annotations

import uuid
from typing import Any

from django.db import models
from django.utils import timezone


class ThemeChoice(models.TextChoices):
    LIGHT = "light", "Light"
    DARK = "dark", "Dark"
    AUTO = "auto", "Auto"


class LanguageChoice(models.TextChoices):
    EN = "en", "English"
    RU = "ru", "Русский"


class FontSizeChoice(models.TextChoices):
    SMALL = "small", "Small"
    MEDIUM = "medium", "Medium"
    LARGE = "large", "Large"


class ProfileVisibilityChoice(models.TextChoices):
    PUBLIC = "public", "Public"
    MEMBERS = "members", "Members Only"
    PRIVATE = "private", "Private"


class UserPreference(models.Model):
    """User personalization preferences.
    
    Stores per-tenant user preferences including theme, language, notifications, and privacy settings.
    Multi-tenant: Each user can have different preferences per tenant.
    
    Example:
        User Alex in tenant AEF: Dark theme, Russian
        User Alex in tenant EC: Light theme, English
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)
    tenant_id = models.UUIDField(db_index=True)

    # Appearance
    theme = models.CharField(
        max_length=10,
        choices=ThemeChoice.choices,
        default=ThemeChoice.AUTO,
        help_text="Theme mode: light, dark, or auto (follows system preference)",
    )
    accent_color = models.CharField(
        max_length=7,
        default="#8B5CF6",
        help_text="Accent color in hex format (e.g., #8B5CF6 for purple)",
    )
    font_size = models.CharField(
        max_length=10,
        choices=FontSizeChoice.choices,
        default=FontSizeChoice.MEDIUM,
        help_text="Font size: small, medium, or large",
    )
    high_contrast = models.BooleanField(
        default=False,
        help_text="Enable high contrast mode for better readability",
    )
    reduce_motion = models.BooleanField(
        default=False,
        help_text="Reduce animations for accessibility",
    )

    # Localization
    language = models.CharField(
        max_length=5,
        choices=LanguageChoice.choices,
        default=LanguageChoice.EN,
        help_text="Interface language",
    )
    timezone = models.CharField(
        max_length=64,
        default="UTC",
        help_text="IANA timezone (e.g., Europe/Moscow, America/New_York)",
    )

    # Notifications (JSONField for granular control)
    notification_settings = models.JSONField(
        default=dict,
        help_text="Notification preferences (delivery channels, types, frequency)",
    )

    # Privacy
    profile_visibility = models.CharField(
        max_length=10,
        choices=ProfileVisibilityChoice.choices,
        default=ProfileVisibilityChoice.MEMBERS,
        help_text="Who can see user profile",
    )
    show_online_status = models.BooleanField(
        default=True,
        help_text="Display online status to others",
    )
    show_vote_history = models.BooleanField(
        default=False,
        help_text="Display voting history on profile",
    )
    share_activity = models.BooleanField(
        default=True,
        help_text="Share activity in community feed",
    )
    allow_mentions = models.BooleanField(
        default=True,
        help_text="Allow other users to @mention you",
    )
    analytics_enabled = models.BooleanField(
        default=True,
        help_text="Collect analytics and usage data (required for platform)",
    )
    recommendations_enabled = models.BooleanField(
        default=True,
        help_text="Enable personalized recommendations based on activity",
    )

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Preference"
        verbose_name_plural = "User Preferences"
        indexes = [
            models.Index(fields=["user_id", "tenant_id"]),
            models.Index(fields=["tenant_id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "tenant_id"],
                name="unique_user_tenant_preference",
            )
        ]

    def __str__(self) -> str:
        return f"Preferences for user {self.user_id} in tenant {self.tenant_id}"

    @classmethod
    def get_or_create_for_user(
        cls, user_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> tuple[UserPreference, bool]:
        """Get or create preferences for user in tenant.
        
        Returns:
            Tuple of (UserPreference instance, created flag)
        """
        return cls.objects.get_or_create(
            user_id=user_id,
            tenant_id=tenant_id,
            defaults=cls.get_default_preferences(),
        )

    @classmethod
    def get_default_preferences(cls) -> dict[str, Any]:
        """Get default preference values for new users.
        
        Returns:
            Dictionary of default field values
        """
        return {
            "theme": ThemeChoice.AUTO,
            "accent_color": "#8B5CF6",
            "font_size": FontSizeChoice.MEDIUM,
            "high_contrast": False,
            "reduce_motion": False,
            "language": LanguageChoice.EN,
            "timezone": "UTC",
            "notification_settings": cls.get_default_notification_settings(),
            "profile_visibility": ProfileVisibilityChoice.MEMBERS,
            "show_online_status": True,
            "show_vote_history": False,
            "share_activity": True,
            "allow_mentions": True,
            "analytics_enabled": True,
            "recommendations_enabled": True,
        }

    @staticmethod
    def get_default_notification_settings() -> dict[str, Any]:
        """Get default notification settings structure.
        
        Returns:
            Dictionary with notification preferences structure
        """
        return {
            "email": {
                "enabled": True,
                "digest": "instant",  # instant | hourly | daily | weekly
            },
            "in_app": {
                "enabled": True,
            },
            "push": {
                "enabled": False,  # MVP: not implemented
            },
            "types": {
                "polls": {
                    "new_vote": {"enabled": True, "channels": ["email", "in_app"]},
                    "closing_soon": {"enabled": True, "channels": ["email", "in_app"]},
                    "results_published": {"enabled": False, "channels": []},
                },
                "events": {
                    "new_event": {"enabled": True, "channels": ["email", "in_app"]},
                    "rsvp_reminder": {"enabled": True, "channels": ["email", "in_app"]},
                    "event_starting": {"enabled": True, "channels": ["email", "in_app"]},
                },
                "community": {
                    "new_member": {"enabled": False, "channels": []},
                    "post_flagged": {"enabled": True, "channels": ["email", "in_app"]},
                    "mention": {"enabled": True, "channels": ["email", "in_app"]},
                },
                "system": {
                    "security_alert": {"enabled": True, "channels": ["email", "in_app"]},
                    "product_update": {"enabled": True, "channels": ["in_app"]},
                },
            },
            "quiet_hours": {
                "enabled": False,
                "start": "22:00",
                "end": "08:00",
            },
        }

    def update_from_dict(self, data: dict[str, Any]) -> None:
        """Update preference fields from dictionary.
        
        Supports partial updates (only provided fields are updated).
        
        Args:
            data: Dictionary with field names and values
        """
        allowed_fields = {
            "theme",
            "accent_color",
            "font_size",
            "high_contrast",
            "reduce_motion",
            "language",
            "timezone",
            "notification_settings",
            "profile_visibility",
            "show_online_status",
            "show_vote_history",
            "share_activity",
            "allow_mentions",
            "analytics_enabled",
            "recommendations_enabled",
        }

        for field, value in data.items():
            if field in allowed_fields and hasattr(self, field):
                setattr(self, field, value)

    def to_dict(self) -> dict[str, Any]:
        """Convert preference to dictionary for API response.
        
        Returns:
            Dictionary with all preference fields
        """
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "tenant_id": str(self.tenant_id),
            "appearance": {
                "theme": self.theme,
                "accent_color": self.accent_color,
                "font_size": self.font_size,
                "high_contrast": self.high_contrast,
                "reduce_motion": self.reduce_motion,
            },
            "localization": {
                "language": self.language,
                "timezone": self.timezone,
            },
            "notifications": self.notification_settings,
            "privacy": {
                "profile_visibility": self.profile_visibility,
                "show_online_status": self.show_online_status,
                "show_vote_history": self.show_vote_history,
                "share_activity": self.share_activity,
                "allow_mentions": self.allow_mentions,
                "analytics_enabled": self.analytics_enabled,
                "recommendations_enabled": self.recommendations_enabled,
            },
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
