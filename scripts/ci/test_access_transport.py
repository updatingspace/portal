"""Real HTTP regressions for the shared transport, run in the Portal environment."""

from __future__ import annotations

import json
import threading
import time
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest
from django.test import override_settings
from ninja.errors import HttpError

from app import access_client


class AccessHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_POST(self) -> None:
        body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        self.server.seen.append(
            (self.client_address[1], self.path, dict(self.headers), body)
        )
        if self.path == "/cold":
            time.sleep(5.2)  # The previous fixed five-second timeout would cancel this.
        elif self.path == "/timeout":
            time.sleep(0.2)
        payload = b'{"allowed":true}'
        self.send_response(302 if self.path == "/redirect" else 200)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Content-Type", "application/json")
        self.send_header("Set-Cookie", "access_session=must-not-cross-users; Path=/")
        if self.path == "/redirect":
            self.send_header("Location", "/must-not-follow")
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass  # One test intentionally cancels the slow response.

    def log_message(self, format: str, *args: object) -> None:
        pass


@pytest.fixture(autouse=True)
def isolated_pool() -> Iterator[None]:
    access_client._close_transport()
    with patch.object(access_client, "getproxies", return_value={}):
        yield
    access_client._close_transport()


@pytest.fixture
def upstream() -> Iterator[ThreadingHTTPServer]:
    with ThreadingHTTPServer(("127.0.0.1", 0), AccessHandler) as server:
        server.seen = []
        server.base_url = f"http://127.0.0.1:{server.server_port}"
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield server
        finally:
            access_client._close_transport()
            server.shutdown()
            thread.join(timeout=5)


def call(upstream: ThreadingHTTPServer, user: str, path: str = "/check") -> bool:
    return access_client.check_access(
        url=upstream.base_url + path,
        body=json.dumps({"user_id": user, "tenant_id": f"tenant-{user}"}).encode(),
        headers={
            "X-User-Id": user,
            "X-Tenant-Id": f"tenant-{user}",
            "X-Request-Id": f"request-{user}",
        },
    )


def test_copies_packaged_in_each_service_match() -> None:
    root = Path(__file__).resolve().parents[2]
    modules = [
        (root / f"services/{service}/src/app/access_client.py").read_bytes()
        for service in ["portal", "activity", "events", "gamification", "voting"]
    ]
    assert all(module == modules[0] for module in modules)


def test_reuses_socket_without_reusing_headers_auth_or_cookies(upstream) -> None:
    with patch.object(
        access_client,
        "private_invoke_headers",
        return_value={"Authorization": "Bearer first"},
    ):
        assert call(upstream, "first")
    assert call(upstream, "second")
    first, second = upstream.seen
    assert first[0] == second[0]
    assert first[2]["Authorization"] == "Bearer first"
    assert "Authorization" not in second[2]
    assert "Cookie" not in first[2] and "Cookie" not in second[2]
    assert second[2]["X-User-Id"] == "second"
    assert json.loads(second[3])["tenant_id"] == "tenant-second"


def test_concurrent_tenants_keep_request_state_separate(upstream) -> None:
    with ThreadPoolExecutor(max_workers=4) as executor:
        assert all(executor.map(lambda user: call(upstream, str(user)), range(12)))
    assert len(upstream.seen) == 12
    for _, _, headers, body in upstream.seen:
        payload = json.loads(body)
        assert headers["X-User-Id"] == payload["user_id"]
        assert headers["X-Tenant-Id"] == payload["tenant_id"]
        assert headers["X-Request-Id"] == "request-" + payload["user_id"]
        assert "Cookie" not in headers
    assert len({item[0] for item in upstream.seen}) <= 4


def test_cold_response_can_finish_after_old_five_second_deadline(upstream) -> None:
    assert call(upstream, "cold", "/cold")
    assert len(upstream.seen) == 1


def test_timeout_is_503_and_next_request_can_succeed(upstream) -> None:
    with (
        override_settings(ACCESS_CHECK_TIMEOUT_SECONDS=0.03),
        pytest.raises(HttpError) as error,
    ):
        call(upstream, "slow", "/timeout")
    assert error.value.status_code == 503
    assert error.value.message["code"] == "ACCESS_UNAVAILABLE"
    assert call(upstream, "healthy")
    assert len(upstream.seen) == 2  # No automatic retry of the failed request.


def test_redirect_is_not_followed(upstream) -> None:
    with pytest.raises(HttpError) as error:
        call(upstream, "redirect", "/redirect")
    assert error.value.status_code == 503
    assert [item[1] for item in upstream.seen] == ["/redirect"]


@pytest.mark.parametrize("value", ["bad", "NaN", "inf", "0", "-1", "31"])
def test_invalid_timeout_falls_back_to_bounded_default(value) -> None:
    with override_settings(ACCESS_CHECK_TIMEOUT_SECONDS=value):
        timeout = access_client._timeout()
    assert timeout.read == 15 and timeout.connect == 3 and timeout.pool == 1


def test_explicit_proxy_configuration_keeps_httpx_routing() -> None:
    with (
        patch.object(
            access_client,
            "getproxies",
            return_value={"https": "http://proxy.test:8080"},
        ),
        patch.object(access_client.httpx, "Client") as factory,
    ):
        access_client._client()
    assert "transport" not in factory.call_args.kwargs
    assert factory.call_args.kwargs["follow_redirects"] is False


def test_fork_reset_does_not_reuse_parent_pool_or_lock() -> None:
    parent = access_client._get_transport()
    lock = access_client._transport_lock
    try:
        access_client._reset_after_fork()
        assert access_client._transport_lock is not lock
        assert access_client._get_transport() is not parent
    finally:
        parent.close()


def test_short_connect_write_and_pool_waits_are_preserved() -> None:
    with override_settings(ACCESS_CHECK_TIMEOUT_SECONDS=20):
        timeout = access_client._timeout()
    assert isinstance(timeout, httpx.Timeout)
    assert timeout.as_dict() == {
        "connect": 3.0,
        "read": 20.0,
        "write": 5.0,
        "pool": 1.0,
    }
