"""Run separately in each service environment, like its regular Django suite."""

from __future__ import annotations

import hashlib
import hmac
import importlib
import io
import json
import os
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
from urllib.parse import urlsplit
from uuid import uuid4

import pytest
from django.test import override_settings
from ninja.errors import HttpError

from app import private_invoke

SERVICE = Path.cwd().name
PRIVATE_BASE = "https://bba123.containers.yandexcloud.net/api/v1"
SECRET = "ci-internal-private-invoke-secret"


@pytest.fixture
def access_client():
    module_name = {"portal": "portal.access", "voting": "tenant_voting.api"}.get(
        SERVICE, f"{SERVICE}.permissions"
    )
    module = importlib.import_module(module_name)
    calls = []

    def response(*args, **kwargs):
        if SERVICE == "portal":
            req = args[0]
            calls.append(
                (req.full_url, {k.lower(): v for k, v in req.header_items()}, req.data)
            )
            return io.BytesIO(b'{"allowed":true}')
        calls.append(
            (
                args[0],
                {k.lower(): v for k, v in kwargs["headers"].items()},
                kwargs["content"],
            )
        )
        return SimpleNamespace(status_code=200, json=lambda: {"allowed": True})

    if SERVICE == "portal":
        target = patch.object(module, "urlopen_no_redirect", side_effect=response)
    elif SERVICE == "activity":
        client = Mock()
        client.post.side_effect = response
        target = patch.object(module.httpx, "Client")
    else:
        target = patch.object(module.httpx, "post", side_effect=response)
    with target as transport:
        if SERVICE == "activity":
            transport.return_value.__enter__.return_value = client
        yield module, calls, transport


def check_permission(module, *, tenant, user, request_id):
    common = {
        "tenant_id": tenant,
        "tenant_slug": "test",
        "user_id": user,
        "request_id": request_id,
    }
    if SERVICE == "portal":
        from portal.context import PortalContext

        ctx = PortalContext(**common, master_flags=frozenset())
        module.AccessService.check(
            ctx, "portal.profile.read_self", scope_type="TENANT", scope_id=tenant
        )
        return True
    common.update(scope_type="TENANT", scope_id=tenant)
    if SERVICE == "voting":
        return module._access_check_allowed(
            **common, action="voting.poll.read", master_flags={}
        )
    return module.has_permission(
        **common,
        permission_key=f"{SERVICE}.read",
        master_flags=frozenset() if SERVICE == "activity" else {},
    )


@pytest.mark.parametrize("base", [PRIVATE_BASE, "http://access:8002/api/v1"])
def test_access_request_preserves_tenant_user_body_and_wire_signature(
    access_client, monkeypatch, base
):
    module, calls, _ = access_client
    fetch = Mock(
        side_effect=lambda *args, **kwargs: io.BytesIO(
            b'{"access_token":"test-iam","expires_in":3600}'
        )
    )
    monkeypatch.setattr(private_invoke, "_cached_token", ("", 0.0))
    monkeypatch.setattr(private_invoke, "urlopen_no_redirect", fetch)
    with (
        override_settings(ACCESS_BASE_URL=base, BFF_INTERNAL_HMAC_SECRET=SECRET),
        patch.dict(os.environ, ACCESS_BASE_URL=base),
    ):
        for request_id in ("request-a", "request-b"):
            tenant, user = str(uuid4()), str(uuid4())
            assert check_permission(
                module, tenant=tenant, user=user, request_id=request_id
            )
            url, headers, body = calls[-1]
            assert url == base + "/access/check"
            assert headers["x-tenant-id"] == tenant
            assert headers["x-user-id"] == user
            assert headers["x-request-id"] == request_id
            payload = json.loads(body)
            assert payload["tenant_id"] == tenant
            assert payload["user_id"] == user
            message = "\n".join(
                [
                    "POST",
                    urlsplit(url).path,
                    hashlib.sha256(body).hexdigest(),
                    request_id,
                    headers["x-updspace-timestamp"],
                ]
            )
            assert (
                headers["x-updspace-signature"]
                == hmac.new(
                    SECRET.encode(), message.encode(), hashlib.sha256
                ).hexdigest()
            )
            if base == PRIVATE_BASE:
                assert headers["authorization"] == "Bearer test-iam"
            else:
                assert "authorization" not in headers
    assert (
        len(calls) == 2
    )  # Only provider credentials, never authorization decisions, are reused.
    assert fetch.call_count == (1 if base == PRIVATE_BASE else 0)


def test_metadata_failure_denies_without_calling_access(access_client, monkeypatch):
    module, calls, transport = access_client
    monkeypatch.setattr(private_invoke, "_cached_token", ("", 0.0))
    monkeypatch.setattr(
        private_invoke, "urlopen_no_redirect", Mock(side_effect=OSError("offline"))
    )
    with (
        override_settings(
            ACCESS_BASE_URL=PRIVATE_BASE, BFF_INTERNAL_HMAC_SECRET=SECRET
        ),
        patch.dict(os.environ, ACCESS_BASE_URL=PRIVATE_BASE),
    ):
        if SERVICE == "portal":
            with pytest.raises(HttpError) as error:
                check_permission(
                    module, tenant=str(uuid4()), user=str(uuid4()), request_id="failed"
                )
            assert error.value.status_code == 502
        else:
            assert not check_permission(
                module, tenant=str(uuid4()), user=str(uuid4()), request_id="failed"
            )
    assert calls == []
    transport.assert_not_called()


@pytest.mark.skipif(
    SERVICE not in {"events", "activity"},
    reason="Only these services use Portal HTTP clients",
)
@override_settings(BFF_INTERNAL_HMAC_SECRET=SECRET)
def test_portal_client_sends_iam_and_signs_actual_api_path(monkeypatch):
    import httpx

    module = importlib.import_module(f"{SERVICE}.portal_client")
    monkeypatch.setattr(private_invoke, "_get_iam_token", lambda: "test-iam")
    captured = []

    def handler(request):
        captured.append(request)
        return httpx.Response(200, json=[] if SERVICE == "activity" else {})

    with override_settings(
        PORTAL_SERVICE_URL=PRIVATE_BASE + "/", BFF_INTERNAL_HMAC_SECRET=SECRET
    ):
        client = module.PortalClient()
    client._client.close()
    client._client = httpx.Client(
        transport=httpx.MockTransport(handler), follow_redirects=False
    )
    ctx = SimpleNamespace(
        tenant_id=str(uuid4()),
        user_id=str(uuid4()),
        tenant_slug="test",
        request_id="portal-request",
        master_flags={},
    )
    try:
        if SERVICE == "events":
            assert client.is_community_member(ctx, "community")
        else:
            assert client.list_profiles(ctx, [ctx.user_id]) == {}
    finally:
        client._client.close()
    request = captured[0]
    assert request.headers["authorization"] == "Bearer test-iam"
    assert request.headers["x-tenant-id"] == ctx.tenant_id
    assert request.headers["x-user-id"] == ctx.user_id
    path = request.url.path
    expected_path = (
        f"/api/v1/communities/community/members/{ctx.user_id}"
        if SERVICE == "events"
        else "/api/v1/portal/internal/profiles"
    )
    assert path == expected_path
    msg = "\n".join(
        [
            "GET",
            path,
            hashlib.sha256(b"").hexdigest(),
            ctx.request_id,
            request.headers["x-updspace-timestamp"],
        ]
    )
    assert (
        request.headers["x-updspace-signature"]
        == hmac.new(SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()
    )


@pytest.mark.skipif(SERVICE not in {"activity", "voting"}, reason="Dependency probes")
def test_dependency_health_uses_canonical_private_url_and_iam(monkeypatch):
    module = importlib.import_module(
        "activity.health" if SERVICE == "activity" else "core.health"
    )
    monkeypatch.setattr(private_invoke, "_get_iam_token", lambda: "test-iam")
    calls = []

    def response(url, **kwargs):
        calls.append((url, kwargs["headers"]))
        return SimpleNamespace(status_code=200)

    with override_settings(
        ACCESS_SERVICE_URL=PRIVATE_BASE.removesuffix("/api/v1") + "/",
        ACCESS_BASE_URL=PRIVATE_BASE + "/",
        ACTIVITY_SERVICE_URL=PRIVATE_BASE + "/",
    ):
        if SERVICE == "activity":
            with patch.object(module.httpx, "Client") as client:
                client.return_value.__enter__.return_value.get.side_effect = response
                module._check_access_service()
        else:
            with patch.object(module.httpx, "get", side_effect=response):
                module._check_access_service()
                module._check_activity_service()
    assert len(calls) == (1 if SERVICE == "activity" else 2)
    for url, headers in calls:
        assert url == PRIVATE_BASE.removesuffix("/api/v1") + "/health"
        assert headers["Authorization"] == "Bearer test-iam"


@pytest.mark.skipif(SERVICE != "voting", reason="Voting HTTP outbox publisher")
@pytest.mark.parametrize("result", ["metadata_failure", 302, 200])
def test_outbox_does_not_ack_auth_failure_or_redirect(monkeypatch, result):
    from contextlib import nullcontext
    from datetime import datetime, timezone

    from tenant_voting.management.commands import publish_outbox as module

    message = SimpleNamespace(
        id=uuid4(),
        tenant_id=uuid4(),
        event_type="vote.cast",
        occurred_at=datetime.now(timezone.utc),
        payload={},
        published_at=None,
        save=Mock(),
    )
    client = Mock()
    client.post.return_value = SimpleNamespace(status_code=result, text="test response")
    token = Mock(return_value="test-iam")
    if result == "metadata_failure":
        token.side_effect = private_invoke.PrivateInvokeError("offline")
    monkeypatch.setattr(private_invoke, "_get_iam_token", token)
    monkeypatch.setattr(module.transaction, "atomic", nullcontext)
    command = module.Command()
    if result == 200:
        command._publish_message(
            client, message, PRIVATE_BASE + "/events/ingest", SECRET
        )
        assert message.published_at is not None
        message.save.assert_called_once()
    else:
        with pytest.raises(
            (private_invoke.PrivateInvokeError, module.OutboxPublishError)
        ):
            command._publish_message(
                client, message, PRIVATE_BASE + "/events/ingest", SECRET
            )
        assert message.published_at is None
        message.save.assert_not_called()
    if result == "metadata_failure":
        client.post.assert_not_called()
    else:
        assert (
            client.post.call_args.kwargs["headers"]["Authorization"]
            == "Bearer test-iam"
        )
