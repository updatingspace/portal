from __future__ import annotations

import json
import threading
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

import httpx
import pytest
from django.http import HttpRequest
from django.test import RequestFactory, override_settings

from bff.api import SESSION_ME_CAPABILITY_PROBES, _load_effective_access_snapshot


def snapshot_context(user: str, tenant: str) -> tuple[HttpRequest, SimpleNamespace]:
    request = RequestFactory().get("/api/v1/session/me", HTTP_ACCEPT_LANGUAGE=user)
    request.request_id = f"request-{user}"
    context = SimpleNamespace(
        user_id=user,
        tenant_id=tenant,
        tenant_slug=tenant,
        master_flags={"suspended": False},
    )
    return request, context


@override_settings(BFF_UPSTREAM_ACCESS_URL="http://access:8002/api/v1")
def test_access_snapshot_checks_overlap_and_preserve_user_tenant_context() -> None:
    # No response can finish before all independent checks have started.
    barrier = threading.Barrier(len(SESSION_ME_CAPABILITY_PROBES) * 2, timeout=3)
    seen = []
    lock = threading.Lock()

    def respond(**kwargs: Any) -> httpx.Response:
        payload = json.loads(kwargs["body"])
        user = payload["user_id"]
        tenant = payload["tenant_id"]
        service = payload["action"].split(".")[0]
        assert tenant == f"tenant-{user}"
        assert payload["scope"] == {"type": "TENANT", "id": tenant}
        assert payload["master_flags"] == {"suspended": False}
        assert payload["return_effective_permissions"] is True
        assert kwargs["method"] == "POST"
        assert kwargs["upstream_path"] == "access/check"
        assert kwargs["incoming_headers"]["Accept-Language"] == user
        assert kwargs["context_headers"]["X-User-Id"] == user
        assert kwargs["context_headers"]["X-Tenant-Id"] == tenant
        assert kwargs["request_id"] == f"request-{user}"
        with lock:
            seen.append((user, payload["action"]))
        barrier.wait()
        return httpx.Response(
            200,
            json={
                "effective_permissions": [f"{service}.{user}", " shared.read ", None],
                "effective_roles": [{"service": service, "name": user}, None],
            },
        )

    with (
        patch("bff.api.proxy_request", side_effect=respond),
        ThreadPoolExecutor(max_workers=2) as executor,
    ):
        futures = {
            user: executor.submit(
                _load_effective_access_snapshot,
                *snapshot_context(user, f"tenant-{user}"),
            )
            for user in ("alice", "bob")
        }
        for user, future in futures.items():
            permissions, roles = future.result(timeout=5)
            assert permissions == sorted(
                [
                    "shared.read",
                    *(
                        f"{service}.{user}"
                        for service, _ in SESSION_ME_CAPABILITY_PROBES
                    ),
                ]
            )
            assert roles == sorted(
                f"{service}:{user}" for service, _ in SESSION_ME_CAPABILITY_PROBES
            )
    assert sorted(seen) == sorted(
        (user, action)
        for user in ("alice", "bob")
        for _, action in SESSION_ME_CAPABILITY_PROBES
    )


@pytest.mark.parametrize("failure", ["timeout", "status", "json", "shape"])
@override_settings(BFF_UPSTREAM_ACCESS_URL="http://access:8002/api/v1")
def test_access_snapshot_preserves_successful_checks_when_one_fails(
    failure: str,
) -> None:
    calls = []

    def respond(**kwargs: Any) -> httpx.Response:
        action = json.loads(kwargs["body"])["action"]
        calls.append(action)
        if action.startswith("portal."):
            if failure == "timeout":
                raise httpx.ReadTimeout("test timeout")
            if failure == "status":
                return httpx.Response(503)
            if failure == "json":
                return httpx.Response(200, content=b"not json")
            return httpx.Response(200, json=[])
        return httpx.Response(
            200,
            json={
                "effective_permissions": [action],
                "effective_roles": [],
            },
        )

    with patch("bff.api.proxy_request", side_effect=respond):
        permissions, roles = _load_effective_access_snapshot(
            *snapshot_context("alice", "tenant-alice")
        )
    assert permissions == sorted(
        action
        for service, action in SESSION_ME_CAPABILITY_PROBES
        if service != "portal"
    )
    assert roles == []
    assert sorted(calls) == sorted(action for _, action in SESSION_ME_CAPABILITY_PROBES)


@override_settings(BFF_UPSTREAM_ACCESS_URL="")
def test_access_snapshot_without_upstream_does_not_make_requests() -> None:
    with patch("bff.api.proxy_request") as proxy:
        assert _load_effective_access_snapshot(
            *snapshot_context("alice", "tenant-alice")
        ) == ([], [])
    proxy.assert_not_called()


@override_settings(BFF_UPSTREAM_ACCESS_URL="http://access:8002/api/v1")
def test_access_snapshot_refreshes_revoked_permissions_without_cache() -> None:
    request, context = snapshot_context("alice", "tenant-alice")
    with patch(
        "bff.api.proxy_request",
        return_value=httpx.Response(
            200,
            json={
                "effective_permissions": ["portal.profile.read_self"],
            },
        ),
    ) as proxy:
        assert _load_effective_access_snapshot(request, context) == (
            ["portal.profile.read_self"],
            [],
        )
        proxy.return_value = httpx.Response(200, json={"effective_permissions": []})
        assert _load_effective_access_snapshot(request, context) == ([], [])
        assert proxy.call_count == len(SESSION_ME_CAPABILITY_PROBES) * 2
