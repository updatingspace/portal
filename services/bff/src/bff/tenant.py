from __future__ import annotations

import re
from dataclasses import dataclass

from django.conf import settings

from .models import Tenant


@dataclass(frozen=True)
class ResolvedTenant:
    id: str
    slug: str


# Slug validation: lowercase alphanumeric + hyphens, 2-32 chars, no leading/trailing hyphen
TENANT_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$")
# Also allow single-char slugs for very short tenant names
TENANT_SLUG_SHORT_RE = re.compile(r"^[a-z0-9]$")


def validate_tenant_slug(slug: str) -> bool:
    """Validate tenant slug format."""
    if not slug or not isinstance(slug, str):
        return False
    slug = slug.strip().lower()
    if len(slug) < 1 or len(slug) > 32:
        return False
    return bool(TENANT_SLUG_RE.match(slug) or TENANT_SLUG_SHORT_RE.match(slug))


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

    slug = parts[0]

    # "portal" is the main app domain (portal.localhost, portal.updspace.com),
    # not a tenant subdomain.  Treat it the same as bare suffix.
    reserved_slugs = getattr(settings, "BFF_RESERVED_HOST_SLUGS", ("portal", "www", "app", "admin"))
    if slug in reserved_slugs:
        return None

    return slug


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


def resolve_tenant_by_slug(slug: str) -> ResolvedTenant | None:
    """Resolve tenant directly by slug (path-based tenancy)."""
    if not validate_tenant_slug(slug):
        return None

    slug = slug.strip().lower()
    tenant = Tenant.objects.filter(slug=slug).only("id", "slug").first()
    if not tenant:
        if getattr(settings, "DEBUG", False) and getattr(
            settings, "BFF_DEV_AUTO_TENANT", False
        ):
            tenant = Tenant.objects.create(slug=slug)
        else:
            return None

    return ResolvedTenant(id=str(tenant.id), slug=tenant.slug)


# Well-known slug for sessions created without a subdomain (path-based tenancy).
GLOBAL_TENANT_SLUG = "__portal__"


def get_or_create_global_tenant() -> ResolvedTenant:
    """Return a global 'portal' Tenant used for tenantless auth sessions.

    In path-based tenancy the real tenant is assigned later via
    ``POST /session/switch-tenant``.  The global tenant serves only as
    a placeholder so that the session store always has a valid
    ``tenant_id``.
    """
    tenant, _created = Tenant.objects.get_or_create(
        slug=GLOBAL_TENANT_SLUG,
    )
    return ResolvedTenant(id=str(tenant.id), slug=tenant.slug)
