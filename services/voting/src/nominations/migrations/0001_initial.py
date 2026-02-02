from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Game",
            fields=[
                (
                    "id",
                    models.SlugField(
                        blank=True,
                        help_text="Стабильный идентификатор игры; не меняйте после создания.",
                        max_length=128,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("title", models.CharField(max_length=255, unique=True)),
                ("genre", models.CharField(blank=True, default="", max_length=255)),
                ("studio", models.CharField(blank=True, default="", max_length=255)),
                ("release_year", models.PositiveIntegerField(blank=True, null=True)),
                ("description", models.TextField(blank=True)),
                ("image_url", models.URLField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Игра",
                "verbose_name_plural": "Игры",
                "ordering": ("title", "id"),
            },
        ),
        migrations.CreateModel(
            name="Voting",
            fields=[
                (
                    "code",
                    models.SlugField(
                        blank=True,
                        help_text="Стабильный идентификатор голосования; не меняйте после создания.",
                        max_length=64,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("order", models.PositiveIntegerField(db_index=True, default=0)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "deadline_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="Опциональный дедлайн для голосования. Не влияет на показ результатов.",
                        null=True,
                    ),
                ),
                (
                    "show_vote_counts",
                    models.BooleanField(
                        default=False,
                        help_text="Если отмечено, API может отдавать количество голосов для связанных номинаций.",
                    ),
                ),
                (
                    "rules",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Гибкие правила голосования (показ результатов, доступ, особенности показа).",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Голосование",
                "verbose_name_plural": "Голосования",
                "ordering": ("order", "title"),
            },
        ),
        migrations.CreateModel(
            name="VotingSettings",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "name",
                    models.CharField(default="Основное голосование", max_length=100),
                ),
                (
                    "deadline_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="После этой даты менять выбор нельзя. Оставьте пустым, чтобы не ограничивать.",
                        null=True,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Настройки голосования",
                "verbose_name_plural": "Настройки голосования",
            },
        ),
        migrations.CreateModel(
            name="Nomination",
            fields=[
                (
                    "id",
                    models.SlugField(
                        help_text="Используется как стабильный идентификатор в API; не меняйте после создания.",
                        max_length=64,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("game", "Игра/игровой объект"),
                            ("review", "Обзор/материал"),
                            ("person", "Персона/обзорщик"),
                            ("custom", "Произвольная сущность"),
                        ],
                        default="game",
                        help_text="Тип модуля для номинации (игры, обзорщики, обзоры, произвольное).",
                        max_length=32,
                    ),
                ),
                (
                    "config",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Доп. настройки модуля номинации (подсказки по payload опций, поведению фронта и т.д.).",
                    ),
                ),
                ("order", models.PositiveIntegerField(db_index=True, default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "voting",
                    models.ForeignKey(
                        default="main",
                        help_text="Голосование, к которому относится номинация.",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="nominations",
                        to="nominations.voting",
                    ),
                ),
            ],
            options={
                "verbose_name": "Номинация",
                "verbose_name_plural": "Номинации",
                "ordering": ("order", "title"),
            },
        ),
        migrations.CreateModel(
            name="NominationOption",
            fields=[
                (
                    "id",
                    models.SlugField(
                        help_text="Используется как стабильный идентификатор в API; не меняйте после создания.",
                        max_length=64,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("image_url", models.URLField(blank=True, null=True)),
                (
                    "payload",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Структурированные данные карточки (обзорщик, ссылка на обзор, роль и др.).",
                    ),
                ),
                ("order", models.PositiveIntegerField(db_index=True, default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "game",
                    models.ForeignKey(
                        blank=True,
                        help_text="Связанная игра с расширенными метаданными.",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="options",
                        to="nominations.game",
                    ),
                ),
                (
                    "nomination",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="options",
                        to="nominations.nomination",
                    ),
                ),
            ],
            options={
                "verbose_name": "Опция номинации",
                "verbose_name_plural": "Опции номинаций",
                "ordering": ("order", "title"),
            },
        ),
        migrations.CreateModel(
            name="NominationVote",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "nomination",
                    models.ForeignKey(
                        db_column="nomination_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="votes",
                        to="nominations.nomination",
                        to_field="id",
                    ),
                ),
                (
                    "option",
                    models.ForeignKey(
                        db_column="option_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="votes",
                        to="nominations.nominationoption",
                        to_field="id",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="nomination_votes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Голос",
                "verbose_name_plural": "Голоса",
                "unique_together": {("user", "nomination")},
            },
        ),
    ]
