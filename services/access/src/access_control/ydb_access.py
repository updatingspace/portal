"""Read authorization facts in one YDB transaction without caching decisions."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

import ydb
from django.db import connection

from access_control.models import Permission, Role
from access_control.permissions_mvp import DEFAULT_MEMBER_ROLE_NAME

# YQL UNION ALL combines columns by name, filling absent columns with NULL.
# This produces one tagged result set: ydb-dbapi 0.1.20 has no nextset support.
# All request values are bound parameters; these table names are model-owned.
_ACCESS_FACTS_QUERY = """
$permission = SELECT key AS permission_key, service
    FROM access_control_permission WHERE key = $permission_key;
$bound_roles = SELECT r.*, b.id AS binding_id
    FROM access_control_rolebinding AS b
    INNER JOIN access_control_role AS r ON b.role_id = r.id
    WHERE b.tenant_id = $tenant_id AND b.user_id = $user_id
      AND r.service IN (SELECT service FROM $permission)
      AND (b.scope_type = "GLOBAL"u
        OR (b.scope_type = "TENANT"u AND b.scope_id = $tenant_scope)
        OR (b.scope_type NOT IN ("GLOBAL"u, "TENANT"u)
          AND b.scope_type = $scope_type AND b.scope_id = $scope_id));
$defaults = SELECT * FROM access_control_role
    WHERE service IN (SELECT service FROM $permission) AND name = $member_role_name
      AND (tenant_id = $tenant_id OR (tenant_id IS NULL AND is_system_template));
$candidate_ids = SELECT id FROM $bound_roles UNION ALL SELECT id FROM $defaults;
SELECT "permission"u AS kind, p.* FROM $permission AS p
UNION ALL
SELECT "override"u AS kind, action FROM access_control_policyoverride
    WHERE tenant_id = $tenant_id AND user_id = $user_id
      AND (permission_key IS NULL OR permission_key = $permission_key)
      AND (expires_at IS NULL OR expires_at > $now)
UNION ALL
SELECT "binding"u AS kind, r.* FROM $bound_roles AS r
UNION ALL
SELECT "default"u AS kind, r.* FROM $defaults AS r
UNION ALL
SELECT "grant"u AS kind, rp.role_id AS id, rp.permission_key AS permission_key
    FROM access_control_rolepermission AS rp
    INNER JOIN access_control_permission AS p ON rp.permission_key = p.key
    WHERE rp.role_id IN (SELECT id FROM $candidate_ids)
      AND ($all_permissions OR rp.permission_key = $permission_key);
"""


@dataclass(frozen=True)
class AccessFacts:
    permission: Permission | None
    override_actions: set[str]
    roles: list[Role]
    permission_keys: set[str]


def _role_from_row(row: dict) -> Role:
    values = []
    names = []
    for field in Role._meta.concrete_fields:
        value = row[field.column]
        if isinstance(value, datetime) and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        names.append(field.attname)
        values.append(value)
    return Role.from_db(connection.alias, names, values)


def load_access_facts(
    *,
    tenant_id: UUID | str,
    user_id: UUID | str,
    permission_key: str,
    scope_type: str,
    scope_id: str,
    now: datetime,
    all_permissions: bool,
) -> AccessFacts:
    parameters = {
        "$tenant_id": (UUID(str(tenant_id)), ydb.PrimitiveType.UUID),
        "$user_id": (UUID(str(user_id)), ydb.PrimitiveType.UUID),
        "$tenant_scope": (str(tenant_id), ydb.PrimitiveType.Utf8),
        "$permission_key": (permission_key, ydb.PrimitiveType.Utf8),
        "$member_role_name": (DEFAULT_MEMBER_ROLE_NAME, ydb.PrimitiveType.Utf8),
        "$scope_type": (str(scope_type), ydb.PrimitiveType.Utf8),
        "$scope_id": (str(scope_id), ydb.PrimitiveType.Utf8),
        "$now": (int(now.timestamp()), ydb.PrimitiveType.Datetime),
        "$all_permissions": (all_permissions, ydb.PrimitiveType.Bool),
    }
    with connection.cursor() as cursor:
        cursor.execute(_ACCESS_FACTS_QUERY, parameters)
        columns = [item[0] for item in cursor.description]
        rows = [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]

    permission = next(
        (
            Permission(key=row["permission_key"], service=row["service"])
            for row in rows
            if row["kind"] == "permission"
        ),
        None,
    )
    actions = {row["action"] for row in rows if row["kind"] == "override"}
    bound = sorted(
        (row for row in rows if row["kind"] == "binding"),
        key=lambda row: row["binding_id"],
    )
    defaults = sorted(
        (row for row in rows if row["kind"] == "default"), key=lambda row: row["id"]
    )
    # A tenant's member role replaces the global template, even if it is empty.
    default = next((row for row in defaults if row["tenant_id"] is not None), None)
    if default is None:
        default = next(iter(defaults), None)
    candidates = [*bound, *([default] if default is not None else [])]
    roles: dict[int, Role] = {}
    for row in candidates:
        if row["id"] not in roles:
            roles[row["id"]] = _role_from_row(row)
    keys = {
        row["permission_key"]
        for row in rows
        if row["kind"] == "grant" and row["id"] in roles
    }
    return AccessFacts(permission, actions, list(roles.values()), keys)
