from __future__ import annotations

import json
import logging
import os
import urllib.request
from urllib.parse import urlparse

from django.conf import settings

from portal.access import AccessService
from portal.models import TenantProvisioningOutbox
from portal.tenant_applications import complete_provisioning

logger = logging.getLogger(__name__)


def process_tenant_event(event: TenantProvisioningOutbox) -> bool:
    current = TenantProvisioningOutbox.objects.filter(id=event.id).first()
    if current is None:
        return False
    event = current
    if event.processed_at is not None:
        return True
    base = (
        os.getenv("ACCESS_BASE_URL") or os.getenv("ACCESS_SERVICE_URL") or ""
    ).rstrip("/")
    if not base:
        return False
    url = (
        f"{base}/internal/tenant-owner"
        if base.endswith("/access")
        else f"{base}/access/internal/tenant-owner"
    )
    payload = event.payload
    body = json.dumps(
        {"tenant_id": str(event.tenant_id), "owner_user_id": payload["owner_user_id"]},
        separators=(",", ":"),
    ).encode()
    request_id = str(event.id)
    headers = {
        "Content-Type": "application/json",
        # Serverless TLS terminates before Django; preserve the trusted target
        # scheme so SecurityMiddleware does not redirect this signed POST.
        "X-Forwarded-Proto": urlparse(url).scheme,
        "X-Request-Id": request_id,
        "X-Tenant-Id": str(event.tenant_id),
        "X-Tenant-Slug": payload["tenant_slug"],
        "X-User-Id": payload["reviewer_user_id"],
        # Persisted outbox events are created only after system-admin approval.
        "X-Master-Flags": '{"system_admin":true}',
        **AccessService._build_signed_headers(
            request_id=request_id, path=urlparse(url).path, body=body
        ),
    }
    try:
        if getattr(settings, "ACCESS_PRIVATE_INVOKE_AUTH", False):
            metadata = urllib.request.Request(
                "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token",
                headers={"Metadata-Flavor": "Google"},
            )
            with urllib.request.urlopen(metadata, timeout=3) as response:
                token = json.load(response)["access_token"]
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(url, data=body, headers=headers, method="POST")
        with urllib.request.urlopen(request, timeout=10) as response:
            result = json.load(response)
        if not isinstance(result, dict) or result.get("ok") is not True:
            return False
    except (OSError, ValueError, KeyError, TypeError):
        logger.warning(
            "Tenant owner provisioning will be retried",
            extra={"event_id": str(event.id)},
            exc_info=True,
        )
        return False
    complete_provisioning(event)
    return True
