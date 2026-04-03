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
    """Homepage modal with multi-tenant support, soft delete, and versioning"""

    class ModalType(models.TextChoices):
        INFO = "info", "Информация"
        WARNING = "warning", "Предупреждение"
        SUCCESS = "success", "Успех"
        PROMO = "promo", "Промо"

    # Multi-tenant support
    tenant_id = models.UUIDField("Tenant ID", db_index=True, null=True, blank=True)

    # Content fields
    title = models.CharField("Заголовок", max_length=255)
    content = models.TextField("Содержание")
    content_html = models.TextField("HTML содержание", blank=True, help_text="Rich text HTML content")
    button_text = models.CharField("Текст кнопки", max_length=100, default="OK")
    button_url = models.CharField("Ссылка кнопки", max_length=500, blank=True)
    modal_type = models.CharField(
        "Тип модалки",
        max_length=50,
        choices=ModalType.choices,
        default=ModalType.INFO,
    )

    # Display settings
    is_active = models.BooleanField("Активна", default=True)
    display_once = models.BooleanField("Показать один раз", default=False)
    start_date = models.DateTimeField("Дата начала показа", null=True, blank=True)
    end_date = models.DateTimeField("Дата окончания показа", null=True, blank=True)
    order = models.IntegerField("Порядок показа", default=0)

    # Localization support
    translations = models.JSONField(
        "Переводы",
        default=dict,
        blank=True,
        help_text='{"ru": {"title": "...", "content": "..."}}',
    )

    # Soft delete
    deleted_at = models.DateTimeField("Удалена", null=True, blank=True)

    # Versioning
    version = models.PositiveIntegerField("Версия", default=1)

    # Audit fields
    created_by = models.UUIDField("Создал", null=True, blank=True)
    updated_by = models.UUIDField("Обновил", null=True, blank=True)
    created_at = models.DateTimeField("Создана", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлена", auto_now=True)

    class Meta:
        ordering = ["order", "-created_at"]
        verbose_name = "Модальное окно главной страницы"
        verbose_name_plural = "Модальные окна главной страницы"
        indexes = [
            models.Index(fields=["tenant_id", "is_active"]),
            models.Index(fields=["start_date", "end_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.modal_type})"

    def soft_delete(self, user_id: uuid.UUID | None = None) -> None:
        """Soft delete the modal"""
        from django.utils import timezone

        self.deleted_at = timezone.now()
        if user_id:
            self.updated_by = user_id
        self.save(update_fields=["deleted_at", "updated_by", "updated_at"])

    def restore(self, user_id: uuid.UUID | None = None) -> None:
        """Restore a soft-deleted modal"""
        self.deleted_at = None
        if user_id:
            self.updated_by = user_id
        self.save(update_fields=["deleted_at", "updated_by", "updated_at"])

    def get_translated_content(self, language: str) -> dict:
        """Get content in specified language with fallback to default"""
        if language in self.translations:
            trans = self.translations[language]
            return {
                "title": trans.get("title", self.title),
                "content": trans.get("content", self.content),
                "button_text": trans.get("button_text", self.button_text),
            }
        return {
            "title": self.title,
            "content": self.content,
            "button_text": self.button_text,
        }


class ContentWidget(models.Model):
    """Content widget for banners, announcements, and promotions"""

    class WidgetType(models.TextChoices):
        BANNER = "banner", "Баннер"
        ANNOUNCEMENT = "announcement", "Объявление"
        PROMOTION = "promotion", "Промо-акция"
        NOTIFICATION = "notification", "Уведомление"

    class Placement(models.TextChoices):
        TOP = "top", "Сверху страницы"
        BOTTOM = "bottom", "Снизу страницы"
        SIDEBAR = "sidebar", "Боковая панель"
        INLINE = "inline", "Внутри контента"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField("Tenant ID", db_index=True)

    # Widget configuration
    name = models.CharField("Название", max_length=255)
    widget_type = models.CharField(
        "Тип виджета",
        max_length=50,
        choices=WidgetType.choices,
        default=WidgetType.BANNER,
    )
    placement = models.CharField(
        "Размещение",
        max_length=50,
        choices=Placement.choices,
        default=Placement.TOP,
    )

    # Content (flexible JSON structure)
    content = models.JSONField(
        "Контент",
        default=dict,
        help_text='{"title": "...", "body": "...", "image_url": "...", "cta_text": "...", "cta_url": "..."}',
    )

    # Display settings
    is_active = models.BooleanField("Активен", default=True)
    start_date = models.DateTimeField("Дата начала", null=True, blank=True)
    end_date = models.DateTimeField("Дата окончания", null=True, blank=True)
    priority = models.IntegerField("Приоритет", default=0, help_text="Higher = more important")

    # Targeting
    target_pages = models.JSONField(
        "Целевые страницы",
        default=list,
        blank=True,
        help_text='["home", "voting", "events"]',
    )
    target_roles = models.JSONField(
        "Целевые роли",
        default=list,
        blank=True,
        help_text='["admin", "member"]',
    )

    # Soft delete
    deleted_at = models.DateTimeField("Удален", null=True, blank=True)

    # Audit fields
    created_by = models.UUIDField("Создал", null=True, blank=True)
    updated_by = models.UUIDField("Обновил", null=True, blank=True)
    created_at = models.DateTimeField("Создан", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлен", auto_now=True)

    class Meta:
        ordering = ["-priority", "-created_at"]
        verbose_name = "Контент-виджет"
        verbose_name_plural = "Контент-виджеты"
        indexes = [
            models.Index(fields=["tenant_id", "widget_type", "is_active"]),
            models.Index(fields=["placement", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.widget_type})"

    def soft_delete(self, user_id: uuid.UUID | None = None) -> None:
        """Soft delete the widget"""
        from django.utils import timezone

        self.deleted_at = timezone.now()
        if user_id:
            self.updated_by = user_id
        self.save(update_fields=["deleted_at", "updated_by", "updated_at"])

    def restore(self, user_id: uuid.UUID | None = None) -> None:
        """Restore soft-deleted widget."""
        self.deleted_at = None
        if user_id:
            self.updated_by = user_id
        self.save(update_fields=["deleted_at", "updated_by", "updated_at"])


class DashboardLayout(models.Model):
    """Saved dashboard layout per user within a tenant."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField("User ID", db_index=True)
    tenant_id = models.UUIDField("Tenant ID", db_index=True)

    layout_name = models.CharField("Название layout", max_length=100, default="default")
    layout_config = models.JSONField(
        "Конфигурация layout",
        default=dict,
        help_text='{"widgets": [{"id": "w1", "x": 0, "y": 0, "w": 6, "h": 4}], "breakpoints": {...}}',
    )
    is_default = models.BooleanField("Layout по умолчанию", default=False)

    deleted_at = models.DateTimeField("Удален", null=True, blank=True)
    created_at = models.DateTimeField("Создан", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлен", auto_now=True)

    class Meta:
        verbose_name = "Dashboard layout"
        verbose_name_plural = "Dashboard layouts"
        ordering = ["-is_default", "-updated_at"]
        unique_together = ["user_id", "tenant_id", "layout_name"]
        indexes = [
            models.Index(fields=["tenant_id", "user_id"]),
            models.Index(fields=["tenant_id", "is_default"]),
        ]

    def __str__(self) -> str:
        return f"{self.layout_name} ({self.user_id})"

    def soft_delete(self) -> None:
        from django.utils import timezone

        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])

    def restore(self) -> None:
        self.deleted_at = None
        self.save(update_fields=["deleted_at", "updated_at"])


class DashboardWidget(models.Model):
    """Widget placement within a dashboard layout."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    layout = models.ForeignKey(
        DashboardLayout,
        on_delete=models.CASCADE,
        related_name="widgets",
    )
    tenant_id = models.UUIDField("Tenant ID", db_index=True)

    widget_key = models.CharField("Ключ виджета", max_length=100)
    position_x = models.PositiveIntegerField("X", default=0)
    position_y = models.PositiveIntegerField("Y", default=0)
    width = models.PositiveIntegerField("Ширина", default=4)
    height = models.PositiveIntegerField("Высота", default=3)
    settings = models.JSONField("Настройки", default=dict, blank=True)
    is_visible = models.BooleanField("Виден", default=True)

    deleted_at = models.DateTimeField("Удален", null=True, blank=True)
    created_at = models.DateTimeField("Создан", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлен", auto_now=True)

    class Meta:
        verbose_name = "Dashboard widget"
        verbose_name_plural = "Dashboard widgets"
        ordering = ["position_y", "position_x", "created_at"]
        unique_together = ["layout", "widget_key"]
        indexes = [
            models.Index(fields=["tenant_id", "is_visible"]),
            models.Index(fields=["layout", "position_y", "position_x"]),
        ]

    def __str__(self) -> str:
        return f"{self.widget_key} on {self.layout_id}"

    def soft_delete(self) -> None:
        from django.utils import timezone

        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])

    def restore(self) -> None:
        self.deleted_at = None
        self.save(update_fields=["deleted_at", "updated_at"])


class ModalAnalytics(models.Model):
    """Analytics tracking for modal views and interactions"""

    class EventType(models.TextChoices):
        VIEW = "view", "Просмотр"
        CLICK = "click", "Клик"
        DISMISS = "dismiss", "Закрытие"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    modal = models.ForeignKey(
        HomePageModal,
        on_delete=models.CASCADE,
        related_name="analytics",
    )
    tenant_id = models.UUIDField("Tenant ID", db_index=True)
    user_id = models.UUIDField("User ID", null=True, blank=True)
    session_id = models.CharField("Session ID", max_length=100, blank=True)

    event_type = models.CharField(
        "Тип события",
        max_length=20,
        choices=EventType.choices,
    )
    timestamp = models.DateTimeField("Время", auto_now_add=True)

    # Additional context
    metadata = models.JSONField("Метаданные", default=dict, blank=True)

    class Meta:
        verbose_name = "Аналитика модалки"
        verbose_name_plural = "Аналитика модалок"
        indexes = [
            models.Index(fields=["modal", "event_type"]),
            models.Index(fields=["tenant_id", "timestamp"]),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} on modal {self.modal_id} at {self.timestamp}"
