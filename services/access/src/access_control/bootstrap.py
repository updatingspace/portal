"""Seed the declared Access baseline when SQL data migrations are unavailable."""

from __future__ import annotations

from dataclasses import dataclass

from django.db import transaction

from access_control.models import Permission, Role, RolePermission
from access_control.permissions_mvp import (
    DEFAULT_MEMBER_ROLE_NAME,
    DEFAULT_MEMBER_ROLE_PERMISSIONS,
    MVP_PERMISSIONS,
)


@dataclass
class SeedResult:
    permissions: int = 0
    roles: int = 0
    role_permissions: int = 0


@transaction.atomic
def seed_access_defaults(*, dry_run: bool = False) -> SeedResult:
    """Add missing baseline entries without changing tenant roles or bindings.

    Global system templates receive declared baseline permissions, as in the
    SQL seed migrations. Existing permissions and extra template grants are
    preserved. A tenant's member role still overrides the global template.
    """
    result = SeedResult()
    specs = {spec.key: spec for spec in MVP_PERMISSIONS}
    templates: dict[str, Role | None] = {}
    for service, keys in DEFAULT_MEMBER_ROLE_PERMISSIONS.items():
        if any(key not in specs or specs[key].service != service for key in keys):
            raise ValueError(f"Invalid default permissions for {service}")
        try:
            role = Role.objects.get(
                tenant_id__isnull=True, service=service, name=DEFAULT_MEMBER_ROLE_NAME
            )
        except Role.DoesNotExist:
            role = None
        if role is not None and not role.is_system_template:
            raise ValueError(f"Global {service} member role is not a system template")
        templates[service] = role

    existing = dict(Permission.objects.values_list("key", "service"))
    for key, spec in specs.items():
        if key in existing:
            if existing[key] != spec.service:
                raise ValueError(f"Permission {key} belongs to an unexpected service")
            continue
        if dry_run:
            result.permissions += 1
        else:
            _, created = Permission.objects.get_or_create(
                key=key,
                defaults={"description": spec.description, "service": spec.service},
            )
            result.permissions += int(created)

    for service, keys in DEFAULT_MEMBER_ROLE_PERMISSIONS.items():
        role = templates[service]
        if role is None:
            result.roles += 1
            if dry_run:
                result.role_permissions += len(set(keys))
                continue
            role = Role.objects.create(
                tenant_id=None,
                service=service,
                name=DEFAULT_MEMBER_ROLE_NAME,
                is_system_template=True,
            )
        existing_keys = set(
            RolePermission.objects.filter(role=role).values_list(
                "permission_id", flat=True
            )
        )
        for key in sorted(set(keys) - existing_keys):
            if dry_run:
                result.role_permissions += 1
            else:
                _, created = RolePermission.objects.get_or_create(
                    role=role, permission_id=key
                )
                result.role_permissions += int(created)
    return result
