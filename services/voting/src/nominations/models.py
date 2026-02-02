from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class Game(models.Model):
    id = models.SlugField(
        max_length=128,
        primary_key=True,
        blank=True,
        help_text="Стабильный идентификатор игры; не меняйте после создания.",
    )
    title = models.CharField(max_length=255, unique=True)
    genre = models.CharField(max_length=255, blank=True, default="")
    studio = models.CharField(max_length=255, blank=True, default="")
    release_year = models.PositiveIntegerField(null=True, blank=True)
    description = models.TextField(blank=True)
    image_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("title", "id")
        verbose_name = "Игра"
        verbose_name_plural = "Игры"

    def __str__(self) -> str:
        return self.title

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = self._generate_id()
        super().save(*args, **kwargs)

    def _generate_id(self) -> str:
        base_slug = slugify(self.title or "") or "game"
        max_length = self._meta.get_field("id").max_length
        candidate = base_slug[:max_length]
        suffix_index = 1
        while self.__class__.objects.exclude(pk=self.pk).filter(id=candidate).exists():
            suffix = f"-{suffix_index}"
            trunc_length = max(max_length - len(suffix), 1)
            base_part = base_slug[:trunc_length] or "game"
            candidate = f"{base_part}{suffix}"
            suffix_index += 1
        return candidate


class Voting(models.Model):
    code = models.SlugField(
        max_length=64,
        primary_key=True,
        blank=True,
        help_text="Стабильный идентификатор голосования; не меняйте после создания.",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0, db_index=True)
    is_active = models.BooleanField(default=True)
    deadline_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Опциональный дедлайн для голосования. Не влияет на показ результатов.",
    )
    show_vote_counts = models.BooleanField(
        default=False,
        help_text="Если отмечено, API может отдавать количество голосов для связанных номинаций.",
    )
    rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="Гибкие правила голосования (показ результатов, доступ, особенности показа).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("order", "title")
        verbose_name = "Голосование"
        verbose_name_plural = "Голосования"

    def __str__(self) -> str:
        return self.title

    @property
    def is_open(self) -> bool:
        if self.deadline_at is None:
            return True
        return timezone.now() <= self.deadline_at

    @property
    def expose_vote_counts(self) -> bool:
        rule_flag = False
        try:
            rule_flag = bool(self.rules.get("show_vote_counts"))
        except Exception:
            # В rules может приехать что угодно, поэтому не ломаемся на невалидных данных.
            rule_flag = False
        return bool(self.show_vote_counts or rule_flag)

    @property
    def is_public(self) -> bool:
        """
        Draft/public flag stored inside flexible rules JSON to avoid schema churn.
        """
        try:
            rules = self.rules or {}
            if isinstance(rules, dict):
                return bool(rules.get("is_public", True))
        except Exception:
            return True
        return True

    def set_public(self, value: bool) -> None:
        rules = self.rules if isinstance(self.rules, dict) else {}
        normalized = dict(rules) if isinstance(rules, dict) else {}
        normalized["is_public"] = bool(value)
        self.rules = normalized

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = self._generate_code()
        super().save(*args, **kwargs)

    def _generate_code(self) -> str:
        base_slug = slugify(self.title or "") or "voting"
        max_length = self._meta.get_field("code").max_length
        candidate = base_slug[:max_length]
        suffix_index = 1
        while (
            self.__class__.objects.exclude(pk=self.pk).filter(code=candidate).exists()
        ):
            suffix = f"-{suffix_index}"
            trunc_length = max(max_length - len(suffix), 1)
            base_part = base_slug[:trunc_length] or "voting"
            candidate = f"{base_part}{suffix}"
            suffix_index += 1
        return candidate


class VotingSettings(models.Model):
    name = models.CharField(max_length=100, default="Основное голосование")
    deadline_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="После этой даты менять выбор нельзя. Оставьте пустым, чтобы не ограничивать.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Настройки голосования"
        verbose_name_plural = "Настройки голосования"

    def __str__(self) -> str:
        return self.name

    @property
    def is_open(self) -> bool:
        if self.deadline_at is None:
            return True
        return timezone.now() <= self.deadline_at

    @classmethod
    def get_solo(cls) -> VotingSettings:
        obj, _ = cls.objects.get_or_create(
            pk=1, defaults={"name": "Основное голосование"}
        )
        return obj


class Nomination(models.Model):
    class NominationKind(models.TextChoices):
        GAME = "game", "Игра/игровой объект"
        REVIEW = "review", "Обзор/материал"
        PERSON = "person", "Персона/обзорщик"
        CUSTOM = "custom", "Произвольная сущность"

    id = models.SlugField(
        max_length=64,
        primary_key=True,
        help_text="Используется как стабильный идентификатор в API; не меняйте после создания.",
    )
    voting = models.ForeignKey(
        Voting,
        on_delete=models.CASCADE,
        related_name="nominations",
        default="main",
        help_text="Голосование, к которому относится номинация.",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    kind = models.CharField(
        max_length=32,
        choices=NominationKind.choices,
        default=NominationKind.GAME,
        help_text="Тип модуля для номинации (игры, обзорщики, обзоры, произвольное).",
    )
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Доп. настройки модуля номинации (подсказки по payload опций, "
            "поведению фронта и т.д.)."
        ),
    )
    order = models.PositiveIntegerField(default=0, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("order", "title")
        verbose_name = "Номинация"
        verbose_name_plural = "Номинации"

    def __str__(self) -> str:
        return self.title


class NominationOption(models.Model):
    id = models.SlugField(
        max_length=64,
        primary_key=True,
        help_text="Используется как стабильный идентификатор в API; не меняйте после создания.",
    )
    game = models.ForeignKey(
        Game,
        on_delete=models.SET_NULL,
        related_name="options",
        null=True,
        blank=True,
        help_text="Связанная игра с расширенными метаданными.",
    )
    nomination = models.ForeignKey(
        Nomination,
        on_delete=models.CASCADE,
        related_name="options",
    )
    title = models.CharField(max_length=255)
    image_url = models.URLField(blank=True, null=True)
    payload = models.JSONField(
        default=dict,
        blank=True,
        help_text="Структурированные данные карточки (обзорщик, ссылка на обзор, роль и др.).",
    )
    order = models.PositiveIntegerField(default=0, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("order", "title")
        verbose_name = "Опция номинации"
        verbose_name_plural = "Опции номинаций"

    def __str__(self) -> str:
        return self.title


class NominationVote(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="nomination_votes",
    )
    nomination = models.ForeignKey(
        Nomination,
        to_field="id",
        db_column="nomination_id",
        on_delete=models.CASCADE,
        related_name="votes",
    )
    option = models.ForeignKey(
        NominationOption,
        to_field="id",
        db_column="option_id",
        on_delete=models.CASCADE,
        related_name="votes",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Голос"
        verbose_name_plural = "Голоса"
        unique_together = ("user", "nomination")

    def __str__(self) -> str:
        return f"{self.user} → {self.nomination_id}:{self.option_id}"
