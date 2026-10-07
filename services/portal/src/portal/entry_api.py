from __future__ import annotations

from uuid import UUID

from django.http import HttpRequest
from ninja import Router, Schema
from ninja.errors import HttpError
from pydantic import Field

from core.errors import error_payload
from core.http import require_request_id
from core.security import require_internal_signature
from portal.access import AccessService
from portal.context import (
    PortalContext,
    _parse_flags,
    _parse_uuid,
    require_portal_context,
)
from portal.memberships import leave_tenant_membership
from portal.models import (
    Tenant,
    TenantApplication,
    TenantMembership,
    TenantProvisioningOutbox,
)
from portal.provisioning import process_tenant_event
from portal.tenant_applications import review_application, submit_application

router = Router(tags=["Tenant onboarding"])


class TenantApplicationIn(Schema):
    slug: str = Field(max_length=64)
    name: str = Field(default="", max_length=128)
    description: str = Field(default="", max_length=4000)


def entry_context(request: HttpRequest) -> PortalContext:
    require_internal_signature(request)
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        raise HttpError(401, error_payload("UNAUTHENTICATED", "User is required"))
    flags = _parse_flags(request.headers.get("X-Master-Flags"))
    if flags & {"suspended", "banned"}:
        raise HttpError(403, error_payload("FORBIDDEN", "Account is unavailable"))
    return PortalContext(
        request_id=require_request_id(request),
        tenant_id=UUID(int=0),
        tenant_slug="",
        user_id=_parse_uuid(user_id, code="INVALID_USER_ID", header="X-User-Id"),
        master_flags=flags,
    )


def admin_context(request: HttpRequest) -> PortalContext:
    ctx = entry_context(request)
    # Tenant admins cannot review creation of other tenants.
    if "system_admin" not in ctx.master_flags:
        raise HttpError(
            403, error_payload("FORBIDDEN", "System administrator required")
        )
    AccessService.check(
        ctx, "portal.tenant_applications.review", scope_type="GLOBAL", scope_id="*"
    )
    return ctx


def application_out(
    application: TenantApplication, *, admin: bool = False
) -> dict[str, str]:
    result = {
        "id": str(application.id),
        "slug": application.slug,
        "status": application.status,
    }
    if admin:
        result.update(
            {
                "tenant_id": str(application.tenant_id),
                "applicant_user_id": str(application.applicant_user_id),
                "name": application.name,
                "description": application.description,
            }
        )
    return result


@router.post("/portal/entry/memberships/{tenant_id}/leave")
def leave_membership(request: HttpRequest, tenant_id: UUID) -> dict[str, str]:
    ctx = entry_context(request)
    return leave_tenant_membership(tenant_id=tenant_id, user_id=ctx.user_id, request_id=ctx.request_id)


@router.get("/portal/entry/memberships", response=list[dict])
def memberships(request: HttpRequest) -> list[dict[str, str]]:
    ctx = entry_context(request)
    return [
        {
            "tenant_id": str(item.tenant_id),
            "tenant_slug": item.tenant.slug,
            "display_name": item.tenant.name,
            "status": item.status,
            "base_role": item.base_role,
        }
        for item in TenantMembership.objects.filter(
            user_id=ctx.user_id, status="active"
        )
        .select_related("tenant")
        .order_by("tenant__slug")
    ]


@router.get("/portal/entry/tenant-applications", response=list[dict])
def own_applications(request: HttpRequest, include_history: bool = False) -> list[dict[str, str]]:
    ctx = entry_context(request)
    return [
        application_out(item)
        for item in TenantApplication.objects.filter(
            applicant_user_id=ctx.user_id,
            **({} if include_history else {"status__in": ["pending", "provisioning"]}),
        ).order_by("created_at")
    ]


@router.post("/portal/entry/tenant-applications", response={201: dict})
def create_application(
    request: HttpRequest, payload: TenantApplicationIn
) -> tuple[int, dict[str, str]]:
    ctx = entry_context(request)
    application = submit_application(user_id=ctx.user_id, **payload.model_dump())
    return 201, application_out(application)


@router.get("/portal/entry/admin/tenant-applications", response=list[dict])
def admin_applications(request: HttpRequest) -> list[dict[str, str]]:
    admin_context(request)
    return [
        application_out(item, admin=True)
        for item in TenantApplication.objects.filter(
            status__in=["pending", "provisioning"],
        ).order_by("created_at")[:200]
    ]


@router.post(
    "/portal/entry/admin/tenant-applications/{application_id}/approve",
    response={200: dict, 202: dict},
)
def approve(request: HttpRequest, application_id: UUID) -> tuple[int, dict[str, str]]:
    ctx = admin_context(request)
    application = review_application(
        application_id=application_id,
        reviewer_id=ctx.user_id,
        approve=True,
        request_id=ctx.request_id,
    )
    if application.status == "provisioning":
        event = TenantProvisioningOutbox.objects.get(application=application)
        process_tenant_event(event)
        application.refresh_from_db()
    return (200 if application.status == "approved" else 202), application_out(
        application, admin=True
    )


@router.post(
    "/portal/entry/admin/tenant-applications/{application_id}/reject", response=dict
)
def reject(request: HttpRequest, application_id: UUID) -> dict[str, str]:
    ctx = admin_context(request)
    application = review_application(
        application_id=application_id,
        reviewer_id=ctx.user_id,
        approve=False,
        request_id=ctx.request_id,
    )
    return application_out(application, admin=True)


class TenantMemberIn(Schema):
    user_id: UUID


@router.post("/portal/tenant-memberships", response=dict)
def enroll_member(request: HttpRequest, payload: TenantMemberIn) -> dict[str, str]:
    """Compatibility bridge for approved legacy account applications."""
    ctx = require_portal_context(request)
    if "system_admin" not in ctx.master_flags:
        raise HttpError(
            403, error_payload("FORBIDDEN", "System administrator required")
        )
    AccessService.check(
        ctx, "portal.tenant_applications.review", scope_type="GLOBAL", scope_id="*"
    )
    tenant = Tenant.objects.filter(id=ctx.tenant_id, slug=ctx.tenant_slug).first()
    if tenant is None:
        raise HttpError(
            409,
            error_payload(
                "TENANT_NOT_REGISTERED", "Import the tenant into Portal first"
            ),
        )
    membership, _ = TenantMembership.objects.get_or_create(
        tenant=tenant,
        user_id=payload.user_id,
        defaults={"status": "active", "base_role": "member"},
    )
    if membership.status != "active":
        raise HttpError(
            409,
            error_payload(
                "MEMBERSHIP_INACTIVE",
                "Membership cannot be reactivated by account approval",
            ),
        )
    return {
        "user_id": str(membership.user_id),
        "tenant_id": str(tenant.id),
        "status": membership.status,
    }
