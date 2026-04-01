from django.contrib import admin

from .models import ContentWidget, HomePageModal, ModalAnalytics, UserPreference


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
        "tenant_id",
        "modal_type",
        "is_active",
        "display_once",
        "start_date",
        "end_date",
        "order",
        "version",
        "deleted_at",
        "created_at",
    ]
    list_filter = ["is_active", "modal_type", "display_once", "tenant_id"]
    search_fields = ["title", "content"]
    readonly_fields = ["id", "version", "created_by", "updated_by", "created_at", "updated_at"]
    ordering = ["order", "-created_at"]
    date_hierarchy = "created_at"

    fieldsets = (
        (None, {"fields": ("tenant_id", "title", "content", "content_html")}),
        (
            "Button",
            {"fields": ("button_text", "button_url")},
        ),
        (
            "Display Settings",
            {
                "fields": (
                    "modal_type",
                    "is_active",
                    "display_once",
                    "start_date",
                    "end_date",
                    "order",
                )
            },
        ),
        (
            "Localization",
            {"fields": ("translations",), "classes": ("collapse",)},
        ),
        (
            "Status",
            {"fields": ("deleted_at", "version")},
        ),
        (
            "Audit",
            {
                "fields": ("created_by", "updated_by", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    actions = ["activate_modals", "deactivate_modals", "soft_delete_modals", "restore_modals"]

    @admin.action(description="Activate selected modals")
    def activate_modals(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f"Activated {count} modals")

    @admin.action(description="Deactivate selected modals")
    def deactivate_modals(self, request, queryset):
        count = queryset.update(is_active=False)
        self.message_user(request, f"Deactivated {count} modals")

    @admin.action(description="Soft delete selected modals")
    def soft_delete_modals(self, request, queryset):
        from django.utils import timezone
        count = queryset.filter(deleted_at__isnull=True).update(deleted_at=timezone.now())
        self.message_user(request, f"Soft deleted {count} modals")

    @admin.action(description="Restore selected modals")
    def restore_modals(self, request, queryset):
        count = queryset.filter(deleted_at__isnull=False).update(deleted_at=None)
        self.message_user(request, f"Restored {count} modals")


@admin.register(ContentWidget)
class ContentWidgetAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "tenant_id",
        "widget_type",
        "placement",
        "is_active",
        "priority",
        "start_date",
        "end_date",
        "deleted_at",
        "created_at",
    ]
    list_filter = ["widget_type", "placement", "is_active", "tenant_id"]
    search_fields = ["name"]
    readonly_fields = ["id", "created_by", "updated_by", "created_at", "updated_at"]
    ordering = ["-priority", "-created_at"]

    fieldsets = (
        (None, {"fields": ("id", "tenant_id", "name")}),
        (
            "Widget Configuration",
            {"fields": ("widget_type", "placement", "content", "priority")},
        ),
        (
            "Display Settings",
            {"fields": ("is_active", "start_date", "end_date")},
        ),
        (
            "Targeting",
            {"fields": ("target_pages", "target_roles"), "classes": ("collapse",)},
        ),
        (
            "Status",
            {"fields": ("deleted_at",)},
        ),
        (
            "Audit",
            {
                "fields": ("created_by", "updated_by", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    actions = ["activate_widgets", "deactivate_widgets", "soft_delete_widgets"]

    @admin.action(description="Activate selected widgets")
    def activate_widgets(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f"Activated {count} widgets")

    @admin.action(description="Deactivate selected widgets")
    def deactivate_widgets(self, request, queryset):
        count = queryset.update(is_active=False)
        self.message_user(request, f"Deactivated {count} widgets")

    @admin.action(description="Soft delete selected widgets")
    def soft_delete_widgets(self, request, queryset):
        from django.utils import timezone
        count = queryset.filter(deleted_at__isnull=True).update(deleted_at=timezone.now())
        self.message_user(request, f"Soft deleted {count} widgets")


@admin.register(ModalAnalytics)
class ModalAnalyticsAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "modal",
        "tenant_id",
        "user_id",
        "event_type",
        "timestamp",
    ]
    list_filter = ["event_type", "tenant_id"]
    search_fields = ["modal__title", "user_id", "session_id"]
    readonly_fields = ["id", "modal", "tenant_id", "user_id", "session_id", "event_type", "timestamp", "metadata"]
    ordering = ["-timestamp"]
    date_hierarchy = "timestamp"
