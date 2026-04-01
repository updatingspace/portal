from django.contrib import admin

from .models import HomePageModal, UserPreference


@admin.register(UserPreference)
class UserPreferenceAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user_id",
        "tenant_id",
        "theme",
        "language",
        "profile_visibility",
        "created_at",
        "updated_at",
    ]
    list_filter = ["theme", "language", "profile_visibility", "tenant_id"]
    search_fields = ["user_id", "tenant_id"]
    readonly_fields = ["id", "created_at", "updated_at"]
    ordering = ["-updated_at"]

    fieldsets = (
        (None, {"fields": ("id", "user_id", "tenant_id")}),
        (
            "Appearance",
            {
                "fields": (
                    "theme",
                    "accent_color",
                    "font_size",
                    "high_contrast",
                    "reduce_motion",
                )
            },
        ),
        ("Localization", {"fields": ("language", "timezone")}),
        ("Notifications", {"fields": ("notification_settings",)}),
        (
            "Privacy",
            {
                "fields": (
                    "profile_visibility",
                    "show_online_status",
                    "show_vote_history",
                    "share_activity",
                    "allow_mentions",
                    "analytics_enabled",
                    "recommendations_enabled",
                )
            },
        ),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(HomePageModal)
class HomePageModalAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "modal_type",
        "is_active",
        "display_once",
        "start_date",
        "end_date",
        "order",
        "created_at",
    ]
    list_filter = ["is_active", "modal_type", "display_once"]
    search_fields = ["title", "content"]
    ordering = ["order", "-created_at"]
    date_hierarchy = "created_at"
