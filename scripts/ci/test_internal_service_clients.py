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

import httpx
import pytest
from django.test import RequestFactory, override_settings
from ninja.errors import HttpError

from app import access_client as shared_access
from app import private_invoke

SERVICE = Path.cwd().name
PRIVATE_BASE = "https://bba123.containers.yandexcloud.net/api/v1"
SECRET = "ci-internal-private-invoke-secret"


@pytest.fixture
def access_client(monkeypatch):
    module_name = {"portal": "portal.access", "voting": "tenant_voting.api"}.get(
        SERVICE, f"{SERVICE}.permissions"
    )
    module = importlib.import_module(module_name)
    calls = []

    def response(request):
        calls.append((str(request.url), dict(request.headers), request.content))
        return httpx.Response(200, json={"allowed": True})

    transport = Mock(spec=httpx.BaseTransport)
    transport.handle_request.side_effect = response
    monkeypatch.setattr(shared_access, "_get_transport", lambda: transport)
    monkeypatch.setattr(shared_access, "getproxies", dict)
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


def test_metadata_failure_reports_unavailable_without_calling_access(
    access_client, monkeypatch
):
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
        with pytest.raises(HttpError) as error:
            check_permission(
                module, tenant=str(uuid4()), user=str(uuid4()), request_id="failed"
            )
        assert error.value.status_code == 503
        assert error.value.message["code"] == "ACCESS_UNAVAILABLE"
    assert calls == []
    transport.handle_request.assert_not_called()


@pytest.mark.parametrize(
    "failure",
    [
        "timeout",
        "network",
        "redirect",
        "unauthorized",
        "server_error",
        "json",
        "list",
        "missing",
        "string",
        "number",
    ],
)
def test_access_failure_is_unavailable_not_a_permission_denial(access_client, failure):
    module, _, transport = access_client
    results = {
        "timeout": httpx.ReadTimeout("slow upstream"),
        "network": httpx.ConnectError("offline"),
        "redirect": httpx.Response(302, headers={"location": "https://other.test/"}),
        "unauthorized": httpx.Response(401),
        "server_error": httpx.Response(500),
        "json": httpx.Response(200, content=b"not-json"),
        "list": httpx.Response(200, json=[]),
        "missing": httpx.Response(200, json={}),
        "string": httpx.Response(200, json={"allowed": "false"}),
        "number": httpx.Response(200, json={"allowed": 1}),
    }
    result = results[failure]
    transport.handle_request.side_effect = None
    if isinstance(result, Exception):
        transport.handle_request.side_effect = result
    else:
        transport.handle_request.return_value = result
    with (
        override_settings(
            ACCESS_BASE_URL="http://access:8002/api/v1", BFF_INTERNAL_HMAC_SECRET=SECRET
        ),
        patch.dict(os.environ, ACCESS_BASE_URL="http://access:8002/api/v1"),
        pytest.raises(HttpError) as error,
    ):
        check_permission(
            module, tenant=str(uuid4()), user=str(uuid4()), request_id="failure"
        )
    assert error.value.status_code == 503
    assert error.value.message["code"] == "ACCESS_UNAVAILABLE"
    assert transport.handle_request.call_count == 1


def test_valid_denial_stays_denied_and_decisions_are_not_cached(access_client):
    module, _, transport = access_client
    transport.handle_request.side_effect = [
        httpx.Response(200, json={"allowed": True}),
        httpx.Response(200, json={"allowed": False}),
    ]
    tenant, user = str(uuid4()), str(uuid4())
    with (
        override_settings(
            ACCESS_BASE_URL="http://access:8002/api/v1", BFF_INTERNAL_HMAC_SECRET=SECRET
        ),
        patch.dict(os.environ, ACCESS_BASE_URL="http://access:8002/api/v1"),
    ):
        assert check_permission(module, tenant=tenant, user=user, request_id="allowed")
        if SERVICE == "portal":
            with pytest.raises(HttpError) as error:
                check_permission(module, tenant=tenant, user=user, request_id="revoked")
            assert error.value.status_code == 403
        else:
            assert not check_permission(
                module, tenant=tenant, user=user, request_id="revoked"
            )
    assert transport.handle_request.call_count == 2


@pytest.mark.django_db
def test_api_exposes_access_unavailable_with_request_id(access_client):
    import time

    from django.test import Client

    _, _, transport = access_client
    transport.handle_request.side_effect = httpx.ReadTimeout("cold access")
    target = {
        "portal": "/api/v1/communities",
        "activity": "/api/v1/feed?from=invalid",
        "events": "/api/v1/events/?from=invalid",
        "gamification": "/api/v1/gamification/achievements?limit=1",
        "voting": "/api/v1/polls?limit=1",
    }[SERVICE]
    tenant, user, rid = str(uuid4()), str(uuid4()), str(uuid4())
    timestamp = str(int(time.time()))
    message = "\n".join(
        ["GET", urlsplit(target).path, hashlib.sha256(b"").hexdigest(), rid, timestamp]
    )
    headers = {
        "HTTP_X_REQUEST_ID": rid,
        "HTTP_X_TENANT_ID": tenant,
        "HTTP_X_TENANT_SLUG": "test",
        "HTTP_X_USER_ID": user,
        "HTTP_X_MASTER_FLAGS": "{}",
        "HTTP_X_UPDSPACE_TIMESTAMP": timestamp,
        "HTTP_X_UPDSPACE_SIGNATURE": hmac.new(
            SECRET.encode(), message.encode(), hashlib.sha256
        ).hexdigest(),
    }
    with (
        override_settings(
            ACCESS_BASE_URL="http://access:8002/api/v1", BFF_INTERNAL_HMAC_SECRET=SECRET
        ),
        patch.dict(os.environ, ACCESS_BASE_URL="http://access:8002/api/v1"),
    ):
        response = Client().get(target, secure=True, **headers)
    assert response.status_code == 503, response.content
    assert response.json()["error"]["code"] == "ACCESS_UNAVAILABLE"
    assert response.json()["error"]["request_id"] == rid


@pytest.mark.skipif(
    SERVICE != "portal", reason="Portal alternative/private permissions"
)
def test_portal_does_not_hide_outage_behind_another_permission():
    from portal import api as module

    failure = HttpError(503, {"code": "ACCESS_UNAVAILABLE"})
    ctx = SimpleNamespace(tenant_id=uuid4())
    with (
        patch.object(module.AccessService, "check", side_effect=failure) as check,
        pytest.raises(HttpError) as error,
    ):
        module._check_any_permissions(
            ctx,
            ["permission-a", "permission-b"],
            scope_type="TENANT",
            scope_id=str(ctx.tenant_id),
        )
    assert error.value.status_code == 503
    check.assert_called_once()
    with (
        patch.object(module, "_ctx", return_value=ctx),
        patch.object(module, "ensure_tenant"),
        patch.object(module.AccessService, "check", side_effect=failure),
        pytest.raises(HttpError) as error,
    ):
        module.posts_list(SimpleNamespace(), scope="public")
    assert error.value.status_code == 503


@pytest.mark.skipif(SERVICE != "activity", reason="Activity news and raw Django views")
def test_activity_news_media_and_sse_preserve_unavailable_error():
    module = importlib.import_module("activity.api")
    sse = importlib.import_module("activity.sse")

    failure = HttpError(
        503, {"code": "ACCESS_UNAVAILABLE", "message": "Access service unavailable"}
    )
    ctx = SimpleNamespace(
        tenant_id=uuid4(),
        user_id=uuid4(),
        tenant_slug="test",
        master_flags=frozenset(),
        request_id="raw-view",
    )
    post = SimpleNamespace(
        status="published",
        visibility="public",
        scope_type="TENANT",
        scope_id=str(ctx.tenant_id),
    )
    with (
        patch.object(module, "require_permission", side_effect=failure),
        pytest.raises(HttpError) as error,
    ):
        module._can_read_news(ctx, post)
    assert error.value.status_code == 503

    request = RequestFactory().put(
        "/api/v1/news/media/upload/token", HTTP_X_REQUEST_ID="raw-view"
    )
    with (
        patch.object(module, "require_activity_context", return_value=ctx),
        patch.object(module, "require_permission", side_effect=failure),
        patch.object(module, "save_local_media_file") as save,
    ):
        response = module.news_media_upload_file(request, token="unparsed-token")
    assert response.status_code == 503
    assert json.loads(response.content)["error"]["request_id"] == "raw-view"
    save.assert_not_called()
    request = RequestFactory().get("/api/v1/feed/sse", HTTP_X_REQUEST_ID="raw-view")
    with (
        patch.object(sse, "require_activity_context", return_value=ctx),
        patch.object(sse, "has_permission", side_effect=failure),
    ):
        response = sse.sse_unread_count(request)
    assert response.status_code == 503
    assert json.loads(response.content)["error"]["code"] == "ACCESS_UNAVAILABLE"


@pytest.mark.skipif(
    SERVICE != "activity", reason="Activity streaming permission checks"
)
@pytest.mark.django_db
def test_live_stream_reports_outage_and_stops_without_publishing_unchecked_event():
    sse = importlib.import_module("activity.sse")

    ctx = SimpleNamespace(
        tenant_id=uuid4(),
        user_id=uuid4(),
        tenant_slug="test",
        master_flags=frozenset(),
        request_id="stream-failure",
    )
    failure = HttpError(
        503, {"code": "ACCESS_UNAVAILABLE", "message": "Access service unavailable"}
    )
    request = RequestFactory().get(
        "/api/v1/feed/live", HTTP_X_REQUEST_ID=ctx.request_id
    )
    clock = [0.0]
    with (
        patch.object(sse, "require_activity_context", return_value=ctx),
        patch.object(sse.time, "monotonic", side_effect=lambda: clock[0]),
        patch.object(sse, "_can_receive_news_change", side_effect=failure),
    ):
        response = sse.sse_feed_live(request)
        stream = iter(response.streaming_content)
        assert b"event: ready" in next(stream)
        news_id = str(uuid4())
        sse.Outbox.objects.create(
            tenant_id=ctx.tenant_id,
            aggregate_type="news",
            aggregate_id=news_id,
            event_type="activity.news.deleted",
            payload_json={"news_id": news_id},
        )
        clock[0] = 2.0
        event = next(stream)
        assert b"event: error" in event and b"ACCESS_UNAVAILABLE" in event
        assert news_id.encode() not in event
        with pytest.raises(StopIteration):
            next(stream)
        response.close()


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
