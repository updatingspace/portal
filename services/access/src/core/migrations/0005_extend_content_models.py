# Generated migration for extended HomePageModal and new ContentWidget, ModalAnalytics

import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0004_userpreference"),
    ]

    operations = [
        # Extend HomePageModal with new fields
        migrations.AddField(
            model_name="homepagemodal",
            name="tenant_id",
            field=models.UUIDField(
                blank=True, db_index=True, null=True, verbose_name="Tenant ID"
            ),
        ),
        migrations.AddField(
            model_name="homepagemodal",
            name="content_html",
            field=models.TextField(
                blank=True, help_text="Rich text HTML content", verbose_name="HTML содержание"
            ),
        ),
        migrations.AddField(
            model_name="homepagemodal",
            name="translations",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='{"ru": {"title": "...", "content": "..."}}',
                verbose_name="Переводы",
            ),
        ),
        migrations.AddField(
            model_name="homepagemodal",
            name="deleted_at",
            field=models.DateTimeField(
                blank=True, null=True, verbose_name="Удалена"
            ),
        ),
        migrations.AddField(
            model_name="homepagemodal",
            name="version",
            field=models.PositiveIntegerField(default=1, verbose_name="Версия"),
        ),
        migrations.AddField(
            model_name="homepagemodal",
            name="created_by",
            field=models.UUIDField(blank=True, null=True, verbose_name="Создал"),
        ),
        migrations.AddField(
            model_name="homepagemodal",
            name="updated_by",
            field=models.UUIDField(blank=True, null=True, verbose_name="Обновил"),
        ),
        # Add indexes for HomePageModal
        migrations.AddIndex(
            model_name="homepagemodal",
            index=models.Index(
                fields=["tenant_id", "is_active"], name="core_homepa_tenant__idx"
            ),
        ),
        migrations.AddIndex(
            model_name="homepagemodal",
            index=models.Index(
                fields=["start_date", "end_date"], name="core_homepa_start_d_idx"
            ),
        ),
        # Create ContentWidget model
        migrations.CreateModel(
            name="ContentWidget",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "tenant_id",
                    models.UUIDField(db_index=True, verbose_name="Tenant ID"),
                ),
                ("name", models.CharField(max_length=255, verbose_name="Название")),
                (
                    "widget_type",
                    models.CharField(
                        choices=[
                            ("banner", "Баннер"),
                            ("announcement", "Объявление"),
                            ("promotion", "Промо-акция"),
                            ("notification", "Уведомление"),
                        ],
                        default="banner",
                        max_length=50,
                        verbose_name="Тип виджета",
                    ),
                ),
                (
                    "placement",
                    models.CharField(
                        choices=[
                            ("top", "Сверху страницы"),
                            ("bottom", "Снизу страницы"),
                            ("sidebar", "Боковая панель"),
                            ("inline", "Внутри контента"),
                        ],
                        default="top",
                        max_length=50,
                        verbose_name="Размещение",
                    ),
                ),
                (
                    "content",
                    models.JSONField(
                        default=dict,
                        help_text='{"title": "...", "body": "...", "image_url": "...", "cta_text": "...", "cta_url": "..."}',
                        verbose_name="Контент",
                    ),
                ),
                (
                    "is_active",
                    models.BooleanField(default=True, verbose_name="Активен"),
                ),
                (
                    "start_date",
                    models.DateTimeField(
                        blank=True, null=True, verbose_name="Дата начала"
                    ),
                ),
                (
                    "end_date",
                    models.DateTimeField(
                        blank=True, null=True, verbose_name="Дата окончания"
                    ),
                ),
                (
                    "priority",
                    models.IntegerField(
                        default=0,
                        help_text="Higher = more important",
                        verbose_name="Приоритет",
                    ),
                ),
                (
                    "target_pages",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text='["home", "voting", "events"]',
                        verbose_name="Целевые страницы",
                    ),
                ),
                (
                    "target_roles",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text='["admin", "member"]',
                        verbose_name="Целевые роли",
                    ),
                ),
                (
                    "deleted_at",
                    models.DateTimeField(
                        blank=True, null=True, verbose_name="Удален"
                    ),
                ),
                (
                    "created_by",
                    models.UUIDField(blank=True, null=True, verbose_name="Создал"),
                ),
                (
                    "updated_by",
                    models.UUIDField(blank=True, null=True, verbose_name="Обновил"),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Создан")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Обновлен")),
            ],
            options={
                "verbose_name": "Контент-виджет",
                "verbose_name_plural": "Контент-виджеты",
                "ordering": ["-priority", "-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="contentwidget",
            index=models.Index(
                fields=["tenant_id", "widget_type", "is_active"],
                name="core_conten_tenant__widget_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="contentwidget",
            index=models.Index(
                fields=["placement", "is_active"], name="core_conten_placem_idx"
            ),
        ),
        # Create ModalAnalytics model
        migrations.CreateModel(
            name="ModalAnalytics",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "tenant_id",
                    models.UUIDField(db_index=True, verbose_name="Tenant ID"),
                ),
                (
                    "user_id",
                    models.UUIDField(
                        blank=True, null=True, verbose_name="User ID"
                    ),
                ),
                (
                    "session_id",
                    models.CharField(
                        blank=True, max_length=100, verbose_name="Session ID"
                    ),
                ),
                (
                    "event_type",
                    models.CharField(
                        choices=[
                            ("view", "Просмотр"),
                            ("click", "Клик"),
                            ("dismiss", "Закрытие"),
                        ],
                        max_length=20,
                        verbose_name="Тип события",
                    ),
                ),
                (
                    "timestamp",
                    models.DateTimeField(auto_now_add=True, verbose_name="Время"),
                ),
                (
                    "metadata",
                    models.JSONField(
                        blank=True, default=dict, verbose_name="Метаданные"
                    ),
                ),
                (
                    "modal",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="analytics",
                        to="core.homepagemodal",
                    ),
                ),
            ],
            options={
                "verbose_name": "Аналитика модалки",
                "verbose_name_plural": "Аналитика модалок",
            },
        ),
        migrations.AddIndex(
            model_name="modalanalytics",
            index=models.Index(
                fields=["modal", "event_type"], name="core_modala_modal_event_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="modalanalytics",
            index=models.Index(
                fields=["tenant_id", "timestamp"], name="core_modala_tenant_time_idx"
            ),
        ),
    ]
