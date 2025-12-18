from __future__ import annotations

from django.conf import settings
from django.db import models


class UserSessionMeta(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="session_meta",
    )
    session_key = models.CharField(max_length=128, db_index=True)
    session_token = models.CharField(
        max_length=255, null=True, blank=True, db_index=True
    )
    user_agent = models.CharField(max_length=512, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_reason = models.CharField(max_length=64, blank=True)

    class Meta:
        verbose_name = "Метаданные сессии пользователя"
        verbose_name_plural = "Метаданные сессий пользователя"
        unique_together = ("user", "session_key")

    def __str__(self) -> str:  # pragma: no cover - для удобства в админке
        return f"{self.user} @ {self.session_key}"


class UserSessionToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="session_tokens",
    )
    session_key = models.CharField(max_length=128, db_index=True)
    refresh_jti = models.CharField(max_length=255, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Связка сессионного ключа и refresh JTI"
        verbose_name_plural = "Связки сессионного ключа и refresh JTI"
        unique_together = ("user", "refresh_jti")

    def __str__(self) -> str:  # pragma: no cover - для удобства в админке
        return f"{self.user} · {self.session_key} · {self.refresh_jti}"


class HomePageModal(models.Model):
    """Модальное окно для главной страницы (персонализация)"""

    title = models.CharField(max_length=255, verbose_name="Заголовок")
    content = models.TextField(verbose_name="Содержание")
    button_text = models.CharField(
        max_length=100, default="OK", verbose_name="Текст кнопки"
    )
    button_url = models.CharField(
        max_length=500, blank=True, verbose_name="Ссылка кнопки"
    )
    modal_type = models.CharField(
        max_length=50,
        choices=[
            ("info", "Информация"),
            ("warning", "Предупреждение"),
            ("success", "Успех"),
            ("promo", "Промо"),
        ],
        default="info",
        verbose_name="Тип модалки",
    )
    is_active = models.BooleanField(default=True, verbose_name="Активна")
    display_once = models.BooleanField(
        default=False, verbose_name="Показать один раз"
    )
    start_date = models.DateTimeField(
        null=True, blank=True, verbose_name="Дата начала показа"
    )
    end_date = models.DateTimeField(
        null=True, blank=True, verbose_name="Дата окончания показа"
    )
    order = models.IntegerField(default=0, verbose_name="Порядок показа")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создана")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Обновлена")

    class Meta:
        verbose_name = "Модальное окно главной страницы"
        verbose_name_plural = "Модальные окна главной страницы"
        ordering = ["order", "-created_at"]

    def __str__(self) -> str:
        return f"{self.title} ({self.get_modal_type_display()})"


__all__ = ["UserSessionMeta", "UserSessionToken", "HomePageModal"]
