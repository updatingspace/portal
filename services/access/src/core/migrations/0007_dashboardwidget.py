import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0006_dashboardlayout"),
    ]

    operations = [
        migrations.CreateModel(
            name="DashboardWidget",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tenant_id", models.UUIDField(db_index=True, verbose_name="Tenant ID")),
                ("widget_key", models.CharField(max_length=100, verbose_name="Ключ виджета")),
                ("position_x", models.PositiveIntegerField(default=0, verbose_name="X")),
                ("position_y", models.PositiveIntegerField(default=0, verbose_name="Y")),
                ("width", models.PositiveIntegerField(default=4, verbose_name="Ширина")),
                ("height", models.PositiveIntegerField(default=3, verbose_name="Высота")),
                ("settings", models.JSONField(blank=True, default=dict, verbose_name="Настройки")),
                ("is_visible", models.BooleanField(default=True, verbose_name="Виден")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Удален")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Создан")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Обновлен")),
                (
                    "layout",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="widgets", to="core.dashboardlayout"),
                ),
            ],
            options={
                "verbose_name": "Dashboard widget",
                "verbose_name_plural": "Dashboard widgets",
                "ordering": ["position_y", "position_x", "created_at"],
                "unique_together": {("layout", "widget_key")},
            },
        ),
        migrations.AddIndex(
            model_name="dashboardwidget",
            index=models.Index(fields=["tenant_id", "is_visible"], name="core_dashbo_tenant__8cd4a2_idx"),
        ),
        migrations.AddIndex(
            model_name="dashboardwidget",
            index=models.Index(fields=["layout", "position_y", "position_x"], name="core_dashbo_layout__f9700e_idx"),
        ),
    ]
