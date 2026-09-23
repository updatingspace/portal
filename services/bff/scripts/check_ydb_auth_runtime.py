"""Exercise BFF auth/session persistence against a disposable local YDB only."""

from __future__ import annotations

import os
import uuid
from datetime import timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings")
django.setup()

import httpx
from django.conf import settings
from django.db import connections, transaction
from django.test import Client, override_settings
from django.utils import timezone

from bff.models import BffOauthState, BffSession, Tenant
from bff.session_store import SessionStore


def main() -> None:
    if (
        settings.DB_DRIVER != "ydb"
        or urlparse(os.environ.get("YDB_ENDPOINT", "")).hostname
        not in {"localhost", "127.0.0.1"}
        or os.environ.get("YDB_DATABASE") != "/local"
    ):
        raise SystemExit("Auth runtime checks require a local /local YDB database")

    run_id = uuid.uuid4().hex
    owner = str(uuid.uuid4())
    tenant = Tenant.objects.create(slug="auth-" + run_id[:12])
    other = Tenant.objects.create(slug="other-" + run_id[:12])
    host = f"{tenant.slug}.updspace.com"
    other_host = f"{other.slug}.updspace.com"
    client = Client()
    store = SessionStore()

    with override_settings(
        ALLOWED_HOSTS=[".updspace.com"],
        BFF_TENANT_HOST_SUFFIX="updspace.com",
        BFF_UPSTREAM_ID_URL="http://localhost:8001/api/v1",
        ID_PUBLIC_BASE_URL="http://localhost:8001",
        BFF_OIDC_CLIENT_ID="local-test-client",
        BFF_OIDC_CLIENT_SECRET="local-test-secret",
        BFF_SESSION_COOKIE_NAME="updspace_session",
    ):
        response = client.get("/api/v1/auth/login?next=/choose-tenant", HTTP_HOST=host)
        assert response.status_code == 302
        state = parse_qs(urlparse(response["Location"]).query)["state"][0]
        stored = BffOauthState.objects.get(state=state)
        assert timezone.is_aware(stored.expires_at)
        assert stored.expires_at > timezone.now()

        callback = "/api/v1/auth/callback"
        params = {"code": "local-auth-code", "state": state}
        response = client.get(callback, params, HTTP_HOST=other_host)
        assert "auth_error=TENANT_MISMATCH" in response["Location"]
        assert BffOauthState.objects.filter(state=state).exists()

        with (
            patch(
                "httpx.Client.post",
                return_value=httpx.Response(
                    200,
                    json={
                        "access_token": "local-only-access-token",
                    },
                ),
            ) as token_call,
            patch(
                "httpx.Client.get",
                return_value=httpx.Response(
                    200,
                    json={
                        "sub": "opaque-local-subject",
                        "user_id": owner,
                        "master_flags": {"email_verified": True},
                    },
                ),
            ),
        ):
            response = client.get(callback, params, HTTP_HOST=host)
            assert response.status_code == 302, response.content[:400]
            assert response["Location"] == "/choose-tenant"
            cookie = response.cookies["updspace_session"]
            assert cookie["httponly"]
            sid = cookie.value
            session = store.get(sid)
            assert session is not None and session.user_id == owner
            assert session.master_flags == {"email_verified": True}
            assert not BffOauthState.objects.filter(state=state).exists()
            response = client.get(callback, params, HTTP_HOST=host)
            assert "auth_error=INVALID_STATE" in response["Location"]
            assert token_call.call_count == 1

        expired = "expired-" + run_id
        BffOauthState.objects.create(
            state=expired,
            tenant_id=tenant.id,
            next_path="/",
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        response = Client().get(
            callback, {"code": "local", "state": expired}, HTTP_HOST=host
        )
        assert "auth_error=INVALID_STATE" in response["Location"]
        assert not BffOauthState.objects.filter(state=expired).exists()

        switched = store.set_active_tenant(
            sid, tenant_id=str(other.id), tenant_slug=other.slug
        )
        assert switched is not None and switched.active_tenant_id == str(other.id)
        cleared = store.clear_active_tenant(sid)
        assert cleared is not None and cleared.active_tenant_id == ""
        assert (
            BffSession.objects.filter(id=uuid.uuid4()).update(active_tenant_slug="none")
            == 0
        )

        response = client.get("/api/v1/session/me", HTTP_HOST=other_host)
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "TENANT_MISMATCH"

        store.revoke(sid)
        assert store.get(sid) is None
        assert timezone.is_aware(BffSession.objects.get(id=sid).revoked_at)
        expired_session = store.create(
            tenant_id=str(tenant.id),
            user_id=owner,
            master_flags={},
            ttl=timedelta(seconds=-60),
        )
        assert store.get(expired_session.session_id) is None

        rollback_id = uuid.uuid4()
        try:
            with transaction.atomic():
                Tenant.objects.create(id=rollback_id, slug="rollback-" + run_id[:12])
                raise RuntimeError("local rollback check")
        except RuntimeError:
            pass
        assert not Tenant.objects.filter(id=rollback_id).exists()

    connections.close_all()
    print(
        "YDB BFF: login, callback, UTC, JSON/FK/NULL, replay, expired state, tenant isolation, switch/clear, revoke/expiry and rollback passed"
    )


if __name__ == "__main__":
    main()
