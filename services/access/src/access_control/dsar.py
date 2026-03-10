from __future__ import annotations

from typing import Any
from uuid import UUID

from django.db.models import Q
from django.utils import timezone

from access_control.models import PolicyOverride, RoleBinding, TenantAdminAuditEvent

ANONYMIZED_USER_ID = UUID("00000000-0000-0000-0000-000000000000")
REDACTED_VALUE = "[redacted]"


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _scrub_metadata(value: Any, *, tokens: set[str]) -> Any:
    if isinstance(value, dict):
        return {key: _scrub_metadata(item, tokens=tokens) for key, item in value.items()}
    if isinstance(value, list):
        return [_scrub_metadata(item, tokens=tokens) for item in value]
    if isinstance(value, str):
        return REDACTED_VALUE if value.strip() in tokens else value
    return value


def _serialize_role_binding(item: RoleBinding) -> dict[str, Any]:
    return {
        "id": item.id,
        "tenant_id": str(item.tenant_id),
        "user_id": str(item.user_id),
        "scope_type": item.scope_type,
        "scope_id": item.scope_id,
        "role_id": item.role_id,
        "created_at": _iso(item.created_at),
    }


def _serialize_policy_override(item: PolicyOverride) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "user_id": str(item.user_id),
        "action": item.action,
        "permission_key": item.permission_id,
        "reason": item.reason,
        "expires_at": _iso(item.expires_at),
        "created_at": _iso(item.created_at),
    }


def _serialize_audit_event(item: TenantAdminAuditEvent) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "performed_by": str(item.performed_by),
        "action": item.action,
        "target_type": item.target_type,
        "target_id": item.target_id,
        "metadata": item.metadata or {},
        "created_at": _iso(item.created_at),
    }


def export_user_data(*, tenant_id: UUID, user_id: UUID) -> dict[str, Any]:
    role_bindings = list(
        RoleBinding.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("created_at", "id")
    )
    policy_overrides = list(
        PolicyOverride.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("created_at", "id")
    )
    audit_events = list(
        TenantAdminAuditEvent.objects.filter(tenant_id=tenant_id)
        .filter(Q(performed_by=user_id) | Q(target_id=str(user_id)))
        .order_by("created_at", "id")
    )

    return {
        "service": "access",
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "exported_at": timezone.now().isoformat(),
        "role_bindings": [_serialize_role_binding(item) for item in role_bindings],
        "policy_overrides": [_serialize_policy_override(item) for item in policy_overrides],
        "audit_events": [_serialize_audit_event(item) for item in audit_events],
    }


def erase_user_data(*, tenant_id: UUID, user_id: UUID) -> dict[str, Any]:
    role_bindings_deleted, _ = RoleBinding.objects.filter(tenant_id=tenant_id, user_id=user_id).delete()
    policy_overrides_deleted, _ = PolicyOverride.objects.filter(
        tenant_id=tenant_id,
        user_id=user_id,
    ).delete()

    tokens = {str(user_id)}
    audit_events_redacted = 0
    audit_queryset = (
        TenantAdminAuditEvent.objects.filter(tenant_id=tenant_id)
        .filter(
            Q(performed_by=user_id)
            | Q(target_id=str(user_id))
            | ~Q(metadata={})
        )
        .only("id", "action", "performed_by", "target_id", "metadata")
        .order_by("id")
    )
    for item in audit_queryset.iterator(chunk_size=200):
        if str(item.action).startswith("dsar."):
            continue
        updates: list[str] = []
        metadata = item.metadata or {}
        new_metadata = _scrub_metadata(metadata, tokens=tokens)
        if item.performed_by == user_id:
            item.performed_by = ANONYMIZED_USER_ID
            updates.append("performed_by")
        if isinstance(item.target_id, str) and item.target_id.strip() == str(user_id):
            item.target_id = REDACTED_VALUE
            updates.append("target_id")
        if new_metadata != metadata:
            item.metadata = new_metadata
            updates.append("metadata")
        if updates:
            item.save(update_fields=updates)
            audit_events_redacted += 1

    return {
        "service": "access",
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "mode": "hybrid",
        "erased_at": timezone.now().isoformat(),
        "counts": {
            "role_bindings_deleted": role_bindings_deleted,
            "policy_overrides_deleted": policy_overrides_deleted,
            "audit_events_redacted": audit_events_redacted,
        },
    }
