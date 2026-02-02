from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings

from .models import Tenant


@dataclass(frozen=True)
class ResolvedTenant:
    id: str
    slug: str


def tenant_slug_from_host(host: str) -> str | None:
    # host can include port: aef.updspace.com:443
    host = host.split(":", 1)[0].strip().lower()
    suffix = getattr(settings, "BFF_TENANT_HOST_SUFFIX", "updspace.com")
    suffix = suffix.strip().lower()

    api_prefix = getattr(settings, "BFF_TENANT_API_PREFIX", "api")
    api_prefix = str(api_prefix or "api").strip().lower()

    if host == suffix:
        return None
    if not host.endswith("." + suffix):
        return None

    sub = host[: -(len(suffix) + 1)]
    # Support nested subdomains if ever needed (e.g. aef.eu.updspace.com)
    # For now, take the left-most label as tenant slug.
    parts = [p for p in sub.split(".") if p]
    if not parts:
        return None

    # Local/proxy dev often uses api.<tenant>.<suffix>
    if parts[0] == api_prefix and len(parts) >= 2:
        return parts[1]

    return parts[0]


def resolve_tenant(host: str) -> ResolvedTenant | None:
    slug = tenant_slug_from_host(host)
    if not slug:
        return None

    tenant = Tenant.objects.filter(slug=slug).only("id", "slug").first()
    if not tenant:
        if getattr(settings, "DEBUG", False) and getattr(
            settings, "BFF_DEV_AUTO_TENANT", False
        ):
            tenant = Tenant.objects.create(slug=slug)
        else:
            return None

    return ResolvedTenant(id=str(tenant.id), slug=tenant.slug)
