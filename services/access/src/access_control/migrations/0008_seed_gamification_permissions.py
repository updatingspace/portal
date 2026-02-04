from __future__ import annotations

from django.db import migrations


GAMIFICATION_PERMISSIONS = [
    ("gamification.achievements.create", "Create achievements", "gamification"),
    ("gamification.achievements.edit", "Edit achievements", "gamification"),
    ("gamification.achievements.publish", "Publish achievements", "gamification"),
    ("gamification.achievements.hide", "Hide achievements", "gamification"),
    ("gamification.achievements.assign", "Assign achievements", "gamification"),
    ("gamification.achievements.revoke", "Revoke achievements", "gamification"),
    ("gamification.achievements.view_private", "View private achievements", "gamification"),
]


def forwards(apps, schema_editor):
    Permission = apps.get_model("access_control", "Permission")
    for key, description, service in GAMIFICATION_PERMISSIONS:
        Permission.objects.update_or_create(
            key=key,
            defaults={"description": description, "service": service},
        )


def backwards(apps, schema_editor):
    Permission = apps.get_model("access_control", "Permission")
    keys = [perm[0] for perm in GAMIFICATION_PERMISSIONS]
    Permission.objects.filter(key__in=keys).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("access_control", "0007_seed_news_manage_permission"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
