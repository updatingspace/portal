from __future__ import annotations

from django.db import migrations


def forwards(apps, schema_editor):
    Permission = apps.get_model("access_control", "Permission")
    Permission.objects.update_or_create(
        key="activity.news.manage",
        defaults={"description": "Manage news posts", "service": "activity"},
    )


def backwards(apps, schema_editor):
    Permission = apps.get_model("access_control", "Permission")
    Permission.objects.filter(key="activity.news.manage").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("access_control", "0006_seed_news_permissions"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
