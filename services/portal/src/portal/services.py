from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone

from portal.context import PortalContext
from portal.models import Tenant


def _sync_tenant_fields(tenant: Tenant, tenant_slug: str) -> Tenant:
    updates: dict[str, str] = {}
    if tenant.name != tenant_slug:
        updates["name"] = tenant_slug

    if tenant.slug != tenant_slug:
        slug_taken = Tenant.objects.filter(slug=tenant_slug).exclude(id=tenant.id).exists()
        if not slug_taken:
            updates["slug"] = tenant_slug

    if updates:
        updates["updated_at"] = timezone.now()
        Tenant.objects.filter(id=tenant.id).update(**updates)
        tenant.refresh_from_db()
    return tenant


def ensure_tenant(ctx: PortalContext) -> Tenant:
    by_id = Tenant.objects.filter(id=ctx.tenant_id).first()
    if by_id:
        return _sync_tenant_fields(by_id, ctx.tenant_slug)

    by_slug = Tenant.objects.filter(slug=ctx.tenant_slug).first()
    if by_slug:
        return _sync_tenant_fields(by_slug, ctx.tenant_slug)

    now = timezone.now()
    try:
        with transaction.atomic():
            return Tenant.objects.create(
                id=ctx.tenant_id,
                slug=ctx.tenant_slug,
                name=ctx.tenant_slug,
                created_at=now,
                updated_at=now,
            )
    except IntegrityError:
        # Race-safe fallback: concurrent request could have created by id or slug first.
        existing = (
            Tenant.objects.filter(id=ctx.tenant_id).first()
            or Tenant.objects.filter(slug=ctx.tenant_slug).first()
        )
        if existing:
            return _sync_tenant_fields(existing, ctx.tenant_slug)
        raise
