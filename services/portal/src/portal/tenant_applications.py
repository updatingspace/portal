from __future__ import annotations

import re
from uuid import UUID

from django.db import IntegrityError, transaction
from django.utils import timezone
from ninja.errors import HttpError

from core.errors import error_payload
from portal.audit import log_audit_event
from portal.models import (
    Tenant,
    TenantApplication,
    TenantMembership,
    TenantProvisioningOutbox,
    TenantSlugClaim,
)

RESERVED_SLUGS = frozenset({"portal", "www", "app", "admin", "api", "id", "auth"})


def submit_application(
    *, user_id: UUID, slug: str, name: str, description: str
) -> TenantApplication:
    slug = slug.strip().lower()
    if (
        not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?", slug)
        or slug in RESERVED_SLUGS
    ):
        raise HttpError(
            400, error_payload("INVALID_SLUG", "Invalid or reserved tenant slug")
        )
    name = name.strip() or slug
    if len(name) > 128 or len(description) > 4000:
        raise HttpError(
            400, error_payload("VALIDATION_ERROR", "Name or description is too long")
        )
    if (
        TenantApplication.objects.filter(
            applicant_user_id=user_id, status__in=["pending", "provisioning"]
        ).count()
        >= 20
    ):
        raise HttpError(
            409,
            error_payload("APPLICATION_LIMIT_REACHED", "Too many pending applications"),
        )
    try:
        with transaction.atomic():
            if (
                Tenant.objects.filter(slug=slug).exists()
                or TenantSlugClaim.objects.filter(slug=slug).exists()
            ):
                raise HttpError(
                    409, error_payload("SLUG_UNAVAILABLE", "Slug is already in use")
                )
            application = TenantApplication.objects.create(
                applicant_user_id=user_id,
                slug=slug,
                name=name,
                description=description.strip(),
            )
            TenantSlugClaim.objects.create(
                slug=slug,
                tenant_id=application.tenant_id,
                application=application,
            )
            return application
    except IntegrityError as exc:
        raise HttpError(
            409, error_payload("SLUG_UNAVAILABLE", "Slug is already in use")
        ) from exc


@transaction.atomic
def review_application(
    *, application_id: UUID, reviewer_id: UUID, approve: bool, request_id: str
) -> TenantApplication:
    application = TenantApplication.objects.filter(id=application_id).first()
    if application is None:
        raise HttpError(404, error_payload("NOT_FOUND", "Application not found"))
    if approve and application.status in {"provisioning", "approved"}:
        return application
    next_status = "provisioning" if approve else "rejected"
    if not TenantApplication.objects.filter(id=application_id, status="pending").update(
        status=next_status,
        reviewed_by_user_id=reviewer_id,
        reviewed_at=timezone.now(),
    ):
        raise HttpError(
            409,
            error_payload("INVALID_APPLICATION_STATUS", "Application is not pending"),
        )
    if approve:
        try:
            with transaction.atomic():
                tenant = Tenant.objects.create(
                    id=application.tenant_id,
                    slug=application.slug,
                    name=application.name,
                )
        except IntegrityError as exc:
            raise HttpError(
                409, error_payload("SLUG_UNAVAILABLE", "Slug is already in use")
            ) from exc
        TenantMembership.objects.create(
            tenant=tenant,
            user_id=application.applicant_user_id,
            base_role="owner",
            status="provisioning",
        )
        TenantProvisioningOutbox.objects.create(
            tenant_id=tenant.id,
            application=application,
            payload={
                "tenant_id": str(tenant.id),
                "tenant_slug": tenant.slug,
                "owner_user_id": str(application.applicant_user_id),
                "reviewer_user_id": str(reviewer_id),
            },
        )
    else:
        TenantSlugClaim.objects.filter(application=application).delete()
    log_audit_event(
        tenant_id=application.tenant_id,
        actor_user_id=reviewer_id,
        action=f"tenant_application.{next_status}",
        target_type="tenant_application",
        target_id=str(application.id),
        request_id=request_id,
    )
    application.refresh_from_db()
    return application


@transaction.atomic
def complete_provisioning(event: TenantProvisioningOutbox) -> None:
    # Called only after Access acknowledged the idempotent owner grant.
    if TenantProvisioningOutbox.objects.filter(
        id=event.id, processed_at__isnull=True
    ).update(processed_at=timezone.now()):
        TenantMembership.objects.filter(
            tenant_id=event.tenant_id,
            user_id=event.application.applicant_user_id,
            status="provisioning",
        ).update(status="active")
        TenantApplication.objects.filter(
            id=event.application_id, status="provisioning"
        ).update(status="approved")
