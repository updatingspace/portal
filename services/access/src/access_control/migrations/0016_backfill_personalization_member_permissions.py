"""Backfill baseline personalization permissions for existing member roles."""
from __future__ import annotations

from django.db import migrations

from access_control.permissions_mvp import MVP_PERMISSIONS

PERSONALIZATION_MEMBER_BASELINE = (
    "personalization.preferences.read_own",
    "personalization.preferences.edit_own",
    "personalization.dashboards.customize",
)


def forwards(apps, schema_editor):
    Permission = apps.get_model("access_control", "Permission")
    Role = apps.get_model("access_control", "Role")
    RolePermission = apps.get_model("access_control", "RolePermission")

    for spec in MVP_PERMISSIONS:
        Permission.objects.update_or_create(
            key=spec.key,
            defaults={"description": spec.description, "service": spec.service},
        )

    permissions_by_key = {
        permission.key: permission
        for permission in Permission.objects.filter(key__in=PERSONALIZATION_MEMBER_BASELINE)
    }

    member_roles = Role.objects.filter(service="personalization", name="member")
    for role in member_roles:
        existing_keys = set(
            RolePermission.objects.filter(role=role).values_list("permission_id", flat=True)
        )
        missing_keys = [
            key for key in PERSONALIZATION_MEMBER_BASELINE
            if key not in existing_keys and key in permissions_by_key
        ]
        if not missing_keys:
            continue

        RolePermission.objects.bulk_create(
            [
                RolePermission(role=role, permission=permissions_by_key[key])
                for key in missing_keys
            ],
            ignore_conflicts=True,
        )


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("access_control", "0015_seed_dashboard_permissions"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
