from __future__ import annotations

from django.db import migrations

from access_control.permissions_mvp import (
    DEFAULT_MEMBER_ROLE_NAME,
    DEFAULT_MEMBER_ROLE_PERMISSIONS,
    MVP_PERMISSIONS,
)


def forwards(apps, schema_editor):
    Permission = apps.get_model("access_control", "Permission")
    Role = apps.get_model("access_control", "Role")
    RolePermission = apps.get_model("access_control", "RolePermission")

    # Keep permission catalog in sync with actually used keys.
    for spec in MVP_PERMISSIONS:
        Permission.objects.update_or_create(
            key=spec.key,
            defaults={"description": spec.description, "service": spec.service},
        )

    # Seed global member role templates for each service.
    for service, permission_keys in DEFAULT_MEMBER_ROLE_PERMISSIONS.items():
        role, _ = Role.objects.update_or_create(
            tenant_id=None,
            service=service,
            name=DEFAULT_MEMBER_ROLE_NAME,
            defaults={"is_system_template": True},
        )

        wanted_keys = set(permission_keys)
        existing_keys = set(
            RolePermission.objects.filter(role=role).values_list("permission_id", flat=True)
        )

        to_add = wanted_keys - existing_keys
        if to_add:
            perms_by_key = {
                p.key: p
                for p in Permission.objects.filter(key__in=to_add)
            }
            RolePermission.objects.bulk_create(
                [
                    RolePermission(role=role, permission=perms_by_key[key])
                    for key in sorted(to_add)
                    if key in perms_by_key
                ],
                ignore_conflicts=True,
            )

        # Keep template aligned with declared default set.
        RolePermission.objects.filter(role=role).exclude(permission_id__in=wanted_keys).delete()


def backwards(apps, schema_editor):
    # Intentionally no-op: baseline templates are forward-only data.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("access_control", "0008_seed_gamification_permissions"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
