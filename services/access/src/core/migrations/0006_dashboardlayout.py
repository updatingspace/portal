from django.db import migrations, models
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0005_extend_content_models"),
    ]

    operations = [
        migrations.CreateModel(
            name="DashboardLayout",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("user_id", models.UUIDField(db_index=True, verbose_name="User ID")),
                ("tenant_id", models.UUIDField(db_index=True, verbose_name="Tenant ID")),
                ("layout_name", models.CharField(default="default", max_length=100, verbose_name="Название layout")),
                (
                    "layout_config",
                    models.JSONField(
                        default=dict,
                        help_text='{"widgets": [{"id": "w1", "x": 0, "y": 0, "w": 6, "h": 4}], "breakpoints": {...}}',
                        verbose_name="Конфигурация layout",
                    ),
                ),
                ("is_default", models.BooleanField(default=False, verbose_name="Layout по умолчанию")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Удален")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Создан")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Обновлен")),
            ],
            options={
                "verbose_name": "Dashboard layout",
                "verbose_name_plural": "Dashboard layouts",
                "ordering": ["-is_default", "-updated_at"],
                "unique_together": {("user_id", "tenant_id", "layout_name")},
            },
        ),
        migrations.AddIndex(
            model_name="dashboardlayout",
            index=models.Index(fields=["tenant_id", "user_id"], name="core_dashbo_tenant__ec9837_idx"),
        ),
        migrations.AddIndex(
            model_name="dashboardlayout",
            index=models.Index(fields=["tenant_id", "is_default"], name="core_dashbo_tenant__1475fb_idx"),
        ),
    ]
