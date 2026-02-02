from __future__ import annotations

from django.utils import timezone

from portal.context import PortalContext
from portal.models import Tenant


def ensure_tenant(ctx: PortalContext) -> Tenant:
    tenant, created = Tenant.objects.get_or_create(
        id=ctx.tenant_id,
        defaults={
            "slug": ctx.tenant_slug,
            "name": ctx.tenant_slug,
            "created_at": timezone.now(),
            "updated_at": timezone.now(),
        },
    )
    if not created:
        updates: dict[str, str] = {}
        if tenant.slug != ctx.tenant_slug:
            updates["slug"] = ctx.tenant_slug
        if tenant.name != ctx.tenant_slug:
            updates["name"] = ctx.tenant_slug
        if updates:
            updates["updated_at"] = timezone.now()
            Tenant.objects.filter(id=tenant.id).update(**updates)
            tenant.refresh_from_db()
    return tenant
