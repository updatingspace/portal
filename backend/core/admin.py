from django.contrib import admin

from .models import HomePageModal


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
