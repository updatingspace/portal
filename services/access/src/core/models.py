import uuid

from django.db import models


class UserPreference(models.Model):
    """User personalization preferences with multi-tenant support"""

    class Theme(models.TextChoices):
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"
        AUTO = "auto", "Auto"

    class Language(models.TextChoices):
        EN = "en", "English"
        RU = "ru", "Русский"

    class FontSize(models.TextChoices):
        SMALL = "small", "Small"
        MEDIUM = "medium", "Medium"
        LARGE = "large", "Large"

    class ProfileVisibility(models.TextChoices):
        PUBLIC = "public", "Public"
        MEMBERS = "members", "Members Only"
        PRIVATE = "private", "Private"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)
    tenant_id = models.UUIDField(db_index=True)

    # Appearance settings
    theme = models.CharField(
        max_length=10,
        choices=Theme.choices,
        default=Theme.AUTO,
    )
    accent_color = models.CharField(max_length=7, default="#007AFF")
    font_size = models.CharField(
        max_length=10,
        choices=FontSize.choices,
        default=FontSize.MEDIUM,
    )
    high_contrast = models.BooleanField(default=False)
    reduce_motion = models.BooleanField(default=False)

    # Localization settings
    language = models.CharField(
        max_length=5,
        choices=Language.choices,
        default=Language.EN,
    )
    timezone = models.CharField(max_length=50, default="UTC")

    # Notification settings (JSONField for flexibility)
    notification_settings = models.JSONField(default=dict)

    # Privacy settings
    profile_visibility = models.CharField(
        max_length=10,
        choices=ProfileVisibility.choices,
        default=ProfileVisibility.MEMBERS,
    )
    show_online_status = models.BooleanField(default=True)
    show_vote_history = models.BooleanField(default=False)
    share_activity = models.BooleanField(default=True)
    allow_mentions = models.BooleanField(default=True)
    analytics_enabled = models.BooleanField(default=True)
    recommendations_enabled = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["user_id", "tenant_id"]
        verbose_name = "User Preference"
        verbose_name_plural = "User Preferences"
        indexes = [
            models.Index(fields=["user_id", "tenant_id"]),
        ]

    def __str__(self) -> str:
        return f"Preferences for user {self.user_id} in tenant {self.tenant_id}"

    def get_default_notification_settings(self) -> dict:
        """Returns default notification settings structure"""
        return {
            "email": {"enabled": True, "digest": "daily"},
            "in_app": {"enabled": True},
            "push": {"enabled": False},
            "types": {
                "polls": {"enabled": True, "channels": ["email", "in_app"]},
                "events": {"enabled": True, "channels": ["email", "in_app"]},
                "community": {"enabled": True, "channels": ["in_app"]},
                "system": {"enabled": True, "channels": ["email", "in_app"]},
            },
            "quiet_hours": {"enabled": False, "start": "22:00", "end": "08:00"},
        }


class HomePageModal(models.Model):
    class ModalType(models.TextChoices):
        INFO = "info", "Информация"
        WARNING = "warning", "Предупреждение"
        SUCCESS = "success", "Успех"
        PROMO = "promo", "Промо"

    title = models.CharField("Заголовок", max_length=255)
    content = models.TextField("Содержание")
    button_text = models.CharField("Текст кнопки", max_length=100, default="OK")
    button_url = models.CharField("Ссылка кнопки", max_length=500, blank=True)
    modal_type = models.CharField(
        "Тип модалки",
        max_length=50,
        choices=ModalType.choices,
        default=ModalType.INFO,
    )
    is_active = models.BooleanField("Активна", default=True)
    display_once = models.BooleanField("Показать один раз", default=False)
    start_date = models.DateTimeField("Дата начала показа", null=True, blank=True)
    end_date = models.DateTimeField("Дата окончания показа", null=True, blank=True)
    order = models.IntegerField("Порядок показа", default=0)
    created_at = models.DateTimeField("Создана", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлена", auto_now=True)

    class Meta:
        ordering = ["order", "-created_at"]
        verbose_name = "Модальное окно главной страницы"
        verbose_name_plural = "Модальные окна главной страницы"
