from __future__ import annotations

import uuid
from typing import Any

from django.db import transaction

from .models import UserPreference


class UserPreferenceService:
    """Business logic for user preferences."""

    @staticmethod
    def get_preferences(user_id: uuid.UUID, tenant_id: uuid.UUID) -> UserPreference:
        """Get user preferences, creating default if not exists.
        
        Args:
            user_id: UUID of the user
            tenant_id: UUID of the tenant
            
        Returns:
            UserPreference instance
        """
        preference, created = UserPreference.get_or_create_for_user(user_id, tenant_id)
        return preference

    @staticmethod
    @transaction.atomic
    def update_preferences(
        user_id: uuid.UUID,
        tenant_id: uuid.UUID,
        updates: dict[str, Any],
    ) -> UserPreference:
        """Update user preferences (partial update supported).
        
        Args:
            user_id: UUID of the user
            tenant_id: UUID of the tenant
            updates: Dictionary with nested updates (appearance, localization, etc.)
            
        Returns:
            Updated UserPreference instance
        """
        preference = UserPreference.objects.select_for_update().get(
            user_id=user_id, tenant_id=tenant_id
        )

        # Flatten nested updates to model fields
        flat_updates = {}
        
        if "appearance" in updates:
            appearance = updates["appearance"]
            for field in ["theme", "accent_color", "font_size", "high_contrast", "reduce_motion"]:
                if field in appearance:
                    flat_updates[field] = appearance[field]
        
        if "localization" in updates:
            localization = updates["localization"]
            for field in ["language", "timezone"]:
                if field in localization:
                    flat_updates[field] = localization[field]
        
        if "notifications" in updates:
            flat_updates["notification_settings"] = updates["notifications"]
        
        if "privacy" in updates:
            privacy = updates["privacy"]
            privacy_fields = [
                "profile_visibility",
                "show_online_status",
                "show_vote_history",
                "share_activity",
                "allow_mentions",
                "analytics_enabled",
                "recommendations_enabled",
            ]
            for field in privacy_fields:
                if field in privacy:
                    flat_updates[field] = privacy[field]

        # Update model
        preference.update_from_dict(flat_updates)
        preference.save()
        
        return preference

    @staticmethod
    def get_defaults() -> dict[str, Any]:
        """Get default preference values for new users.
        
        Returns:
            Dictionary with default preferences structure
        """
        defaults = UserPreference.get_default_preferences()
        return {
            "appearance": {
                "theme": defaults["theme"],
                "accent_color": defaults["accent_color"],
                "font_size": defaults["font_size"],
                "high_contrast": defaults["high_contrast"],
                "reduce_motion": defaults["reduce_motion"],
            },
            "localization": {
                "language": defaults["language"],
                "timezone": defaults["timezone"],
            },
            "notifications": defaults["notification_settings"],
            "privacy": {
                "profile_visibility": defaults["profile_visibility"],
                "show_online_status": defaults["show_online_status"],
                "show_vote_history": defaults["show_vote_history"],
                "share_activity": defaults["share_activity"],
                "allow_mentions": defaults["allow_mentions"],
                "analytics_enabled": defaults["analytics_enabled"],
                "recommendations_enabled": defaults["recommendations_enabled"],
            },
        }

    @staticmethod
    def reset_to_defaults(user_id: uuid.UUID, tenant_id: uuid.UUID) -> UserPreference:
        """Reset user preferences to defaults.
        
        Args:
            user_id: UUID of the user
            tenant_id: UUID of the tenant
            
        Returns:
            Updated UserPreference instance with default values
        """
        defaults = UserPreference.get_default_preferences()
        return UserPreferenceService.update_preferences(
            user_id,
            tenant_id,
            {
                "appearance": {
                    "theme": defaults["theme"],
                    "accent_color": defaults["accent_color"],
                    "font_size": defaults["font_size"],
                    "high_contrast": defaults["high_contrast"],
                    "reduce_motion": defaults["reduce_motion"],
                },
                "localization": {
                    "language": defaults["language"],
                    "timezone": defaults["timezone"],
                },
                "notifications": defaults["notification_settings"],
                "privacy": {
                    "profile_visibility": defaults["profile_visibility"],
                    "show_online_status": defaults["show_online_status"],
                    "show_vote_history": defaults["show_vote_history"],
                    "share_activity": defaults["share_activity"],
                    "allow_mentions": defaults["allow_mentions"],
                    "analytics_enabled": defaults["analytics_enabled"],
                    "recommendations_enabled": defaults["recommendations_enabled"],
                },
            },
        )
