from django import forms
from django.contrib import admin

from .models import Nomination, NominationOption, NominationVote, Voting, VotingSettings


@admin.register(Voting)
class VotingAdmin(admin.ModelAdmin):
    list_display = ("title", "code", "is_active", "show_vote_counts", "deadline_at", "updated_at")
    search_fields = ("title", "code", "description")
    list_filter = ("is_active", "show_vote_counts")
    ordering = ("order", "title")
    readonly_fields = ("created_at", "updated_at")
    prepopulated_fields = {"code": ("title",)}
    fields = (
        "code",
        "title",
        "description",
        "is_active",
        "show_vote_counts",
        "rules",
        "deadline_at",
        "order",
        "created_at",
        "updated_at",
    )

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.pk:
            return ("code",) + self.readonly_fields
        return self.readonly_fields

    def get_prepopulated_fields(self, request, obj=None):
        if obj and obj.pk:
            return {}
        return super().get_prepopulated_fields(request, obj)


@admin.register(VotingSettings)
class VotingSettingsAdmin(admin.ModelAdmin):
    list_display = ("name", "deadline_at", "is_open_display", "updated_at")
    readonly_fields = ("created_at", "updated_at")
    fields = ("name", "deadline_at", "created_at", "updated_at")

    @admin.display(boolean=True, description="Голосование открыто")
    def is_open_display(self, obj: VotingSettings) -> bool:
        return obj.is_open

    def has_add_permission(self, request):
        # Один инстанс настроек на проект (историческое поле для совместимости).
        return not VotingSettings.objects.exists()


class NominationOptionInlineForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.fields["id"].disabled = True

    class Meta:
        model = NominationOption
        fields = "__all__"


class NominationOptionInline(admin.TabularInline):
    model = NominationOption
    form = NominationOptionInlineForm
    extra = 1
    fields = ("id", "title", "image_url", "order", "is_active", "created_at", "updated_at")
    readonly_fields = ("created_at", "updated_at")
    prepopulated_fields = {"id": ("title",)}
    ordering = ("order", "title")
    show_change_link = True

    def get_prepopulated_fields(self, request, obj=None):
        # Не трогаем ID при редактировании, только при создании.
        if obj and obj.pk:
            return {}
        return super().get_prepopulated_fields(request, obj)


@admin.register(Nomination)
class NominationAdmin(admin.ModelAdmin):
    list_display = ("title", "id", "voting", "is_active", "order", "options_count", "updated_at")
    search_fields = ("title", "id", "description")
    list_filter = ("is_active", "voting")
    ordering = ("voting__order", "order", "title")
    readonly_fields = ("created_at", "updated_at")
    inlines = (NominationOptionInline,)
    prepopulated_fields = {"id": ("title",)}
    autocomplete_fields = ("voting",)

    def get_prepopulated_fields(self, request, obj=None):
        if obj and obj.pk:
            return {}
        return super().get_prepopulated_fields(request, obj)

    @admin.display(description="Количество опций")
    def options_count(self, obj: Nomination) -> int:
        return obj.options.count()

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.pk:
            return ("id",) + self.readonly_fields
        return self.readonly_fields


@admin.register(NominationOption)
class NominationOptionAdmin(admin.ModelAdmin):
    list_display = ("title", "id", "nomination", "is_active", "order", "updated_at")
    search_fields = ("title", "id", "nomination__title", "nomination__id")
    list_filter = ("is_active", "nomination")
    ordering = ("nomination__order", "order", "title")
    readonly_fields = ("created_at", "updated_at")
    prepopulated_fields = {"id": ("title",)}
    autocomplete_fields = ("nomination",)

    def get_prepopulated_fields(self, request, obj=None):
        if obj and obj.pk:
            return {}
        return super().get_prepopulated_fields(request, obj)

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.pk:
            return ("id",) + self.readonly_fields
        return self.readonly_fields


@admin.register(NominationVote)
class NominationVoteAdmin(admin.ModelAdmin):
    list_display = ("nomination", "option", "user", "updated_at")
    search_fields = (
        "nomination__id",
        "nomination__title",
        "option__id",
        "option__title",
        "user__username",
        "user__email",
    )
    list_filter = ("nomination",)
    readonly_fields = ("created_at", "updated_at")
    autocomplete_fields = ("nomination", "option", "user")
    list_select_related = ("nomination", "option", "user")
