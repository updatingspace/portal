from uuid import UUID

from core.errors import error_payload
from django.db import transaction
from ninja.errors import HttpError

from portal.audit import log_audit_event
from portal.models import TenantMembership


def leave_tenant_membership(*, tenant_id: UUID, user_id: UUID, request_id: str) -> dict[str, str]:
    with transaction.atomic():
        membership = TenantMembership.objects.filter(tenant_id=tenant_id, user_id=user_id).first()
        if membership is None:
            raise HttpError(404, error_payload("MEMBERSHIP_NOT_FOUND", "Membership not found"))
        if membership.base_role == "owner":
            raise HttpError(409, error_payload("OWNER_CANNOT_LEAVE", "Community owners cannot leave"))
        if membership.status == "left":
            return {"tenant_id": str(tenant_id), "status": "left"}
        if membership.status != "active":
            raise HttpError(409, error_payload("MEMBERSHIP_INACTIVE", "Membership is not active"))
        # Compare-and-set protects concurrent status/ownership changes.
        changed = TenantMembership.objects.filter(
            id=membership.id, tenant_id=tenant_id, user_id=user_id,
            status="active", base_role=membership.base_role,
        ).update(status="left")
        if not changed:
            raise HttpError(409, error_payload("MEMBERSHIP_CHANGED", "Membership changed; refresh and retry"))
        log_audit_event(tenant_id=tenant_id, actor_user_id=user_id, action="membership.left", target_type="tenant_membership", target_id=str(membership.id), request_id=request_id)
    return {"tenant_id": str(tenant_id), "status": "left"}
