from __future__ import annotations

import json
import os
import threading
from collections.abc import Callable, Iterable, Iterator
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch
from urllib.request import getproxies

import httpx
import pytest
from django.test import override_settings

from bff import proxy


class EchoHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self) -> None:
        payload = json.dumps(
            {
                "port": self.client_address[1],
                "path": self.path,
                "headers": dict(self.headers),
            }
        ).encode()
        self.send_response(302 if self.path == "/redirect" else 200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Set-Cookie", "upstream_session=other-user; Path=/")
        if self.path == "/redirect":
            self.send_header("Location", "/should-not-follow")
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args: object) -> None:
        pass


@pytest.fixture
def upstream() -> Iterator[str]:
    with ThreadingHTTPServer(("127.0.0.1", 0), EchoHandler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}"
        finally:
            proxy._close_transport()
            server.shutdown()
            thread.join(timeout=5)


@pytest.fixture(autouse=True)
def isolated_pool() -> Iterator[None]:
    proxy._close_transport()
    with patch("bff.proxy.getproxies", return_value={}):
        yield
    proxy._close_transport()


def call_proxy(
    upstream: str, user: str, *, stream: bool = False
) -> (
    httpx.Response
    | tuple[httpx.Response, Callable[[], Iterable[bytes]], Callable[[], None]]
):
    return proxy.proxy_request(
        upstream_base_url=upstream,
        upstream_path="/echo",
        method="GET",
        query_string=f"user={user}",
        body=b"",
        incoming_headers={
            "Cookie": "browser-session=must-not-forward",
            "Authorization": "Bearer must-not-forward",
        },
        context_headers={
            "X-Tenant-Id": f"tenant-{user}",
            "X-User-Id": user,
            "X-Request-Id": f"request-{user}",
        },
        request_id=f"request-{user}",
        stream=stream,
        timeout=2,
    )


def test_reuses_connection_without_reusing_cookies_or_headers(upstream: str) -> None:
    with proxy.get_httpx_client() as first:
        a = first.get(upstream, headers={"Authorization": "Bearer first-user"}).json()
        assert first.cookies["upstream_session"] == "other-user"
        first.headers["X-User-Id"] = "first-user"
    with proxy.get_httpx_client() as second:
        b = second.get(upstream).json()
    assert a["port"] == b["port"]
    for header in ("Cookie", "Authorization", "X-User-Id"):
        assert header not in b["headers"]


def test_private_auth_and_tenant_context_do_not_leak_on_reused_connection(
    upstream: str,
) -> None:
    with override_settings(
        BFF_PRIVATE_INVOKE_UPSTREAMS=(upstream,), YC_IAM_TOKEN="iam-a"
    ):
        first = call_proxy(upstream, "a").json()
    with override_settings(BFF_PRIVATE_INVOKE_UPSTREAMS=()):
        second = call_proxy(upstream, "b").json()
    assert first["port"] == second["port"]
    assert first["headers"]["Authorization"] == "Bearer iam-a"
    assert "Authorization" not in second["headers"]
    for user, result in (("a", first), ("b", second)):
        assert result["headers"]["X-Tenant-Id"] == f"tenant-{user}"
        assert result["headers"]["X-User-Id"] == user
        assert result["headers"]["X-Request-Id"] == f"request-{user}"
        assert "Cookie" not in result["headers"]
    assert (
        first["headers"]["X-Updspace-Signature"]
        != second["headers"]["X-Updspace-Signature"]
    )


def test_concurrent_users_keep_separate_request_state(upstream: str) -> None:
    def fetch(number: int) -> dict[str, object]:
        return call_proxy(upstream, str(number)).json()

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(fetch, range(32)))
    for number, result in enumerate(results):
        assert result["path"] == f"/echo?user={number}"
        assert result["headers"]["X-Tenant-Id"] == f"tenant-{number}"
        assert result["headers"]["X-User-Id"] == str(number)
        assert "Cookie" not in result["headers"]
        assert "Authorization" not in result["headers"]
    assert len({result["port"] for result in results}) <= 8


def test_stream_consumption_releases_connection_for_next_request(upstream: str) -> None:
    response, iterator, close = call_proxy(upstream, "a", stream=True)
    first = json.loads(b"".join(iterator()))
    close()
    assert response.is_closed
    second = call_proxy(upstream, "b").json()
    assert first["port"] == second["port"]
    assert "Cookie" not in second["headers"]


def test_unread_stream_close_releases_pool_slot(upstream: str) -> None:
    # A leaked streamed response would exhaust this single-connection pool.
    with (
        httpx.HTTPTransport(limits=httpx.Limits(max_connections=1)) as transport,
        patch.object(proxy, "_TRANSPORT", transport),
    ):
        response, _iterator, close = call_proxy(upstream, "a", stream=True)
        close()
        close()
        assert response.is_closed
        assert call_proxy(upstream, "b").status_code == 200


def test_redirects_remain_disabled(upstream: str) -> None:
    with proxy.get_httpx_client() as client:
        response = client.get(upstream + "/redirect")
    assert response.status_code == 302
    assert response.history == []


@pytest.mark.parametrize("stream", [False, True])
def test_timeout_is_passed_per_request(stream: bool) -> None:
    seen = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request.extensions["timeout"])
        raise httpx.ReadTimeout("upstream timed out", request=request)

    with patch.object(proxy, "_TRANSPORT", httpx.MockTransport(handle)):
        with pytest.raises(httpx.ReadTimeout):
            call_proxy("https://example.invalid", "a", stream=stream)
        with (
            override_settings(BFF_PROXY_TIMEOUT_SECONDS=7),
            proxy.get_httpx_client() as client,
            pytest.raises(httpx.ReadTimeout),
        ):
            client.get("https://example.invalid")
    assert seen == [
        {"connect": 2, "read": 2, "write": 2, "pool": 2},
        {"connect": 7, "read": 7, "write": 7, "pool": 7},
    ]


def test_stream_open_failure_closes_request_client() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("upstream refused connection", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handle))
    with (
        patch("bff.proxy.get_httpx_client", return_value=client),
        pytest.raises(httpx.ConnectError),
    ):
        call_proxy("https://example.invalid", "a", stream=True)
    assert client.is_closed


@pytest.mark.parametrize("scheme", ["http", "https", "all"])
def test_environment_proxy_routing_is_not_bypassed(scheme: str) -> None:
    with (
        patch(
            "bff.proxy.getproxies", return_value={scheme: "http://proxy.invalid:8080"}
        ),
        patch("bff.proxy.httpx.Client") as client,
    ):
        proxy.get_httpx_client(timeout=3)
    client.assert_called_once_with(timeout=3, follow_redirects=False)


@pytest.mark.parametrize("variable", ["HTTP_PROXY", "http_proxy", "ALL_PROXY"])
def test_environment_proxy_and_no_proxy_reach_expected_destination(
    upstream: str, variable: str
) -> None:
    with (
        patch.dict(os.environ, {variable: upstream}, clear=True),
        patch("bff.proxy.getproxies", side_effect=getproxies),
    ):
        with proxy.get_httpx_client() as client:
            proxied = client.get("http://unresolvable.invalid/proxied").json()
        assert proxied["path"] == "http://unresolvable.invalid/proxied"
        with (
            patch.dict(os.environ, {"NO_PROXY": "127.0.0.1"}),
            proxy.get_httpx_client() as client,
        ):
            direct = client.get(upstream + "/direct").json()
        assert direct["path"] == "/direct"


def test_no_proxy_alone_does_not_disable_pool(upstream: str) -> None:
    with patch("bff.proxy.getproxies", return_value={"no": "localhost,127.0.0.1"}):
        with proxy.get_httpx_client() as first:
            a = first.get(upstream).json()
        with proxy.get_httpx_client() as second:
            b = second.get(upstream).json()
    assert a["port"] == b["port"]


@pytest.mark.skipif(not hasattr(os, "fork"), reason="requires POSIX fork")
def test_child_does_not_inherit_parent_pool_or_locked_mutex() -> None:
    parent_transport = proxy._get_transport()
    parent_lock = proxy._TRANSPORT_LOCK
    with parent_lock:
        child_pid = os.fork()
        if child_pid == 0:
            # Fail promptly instead of hanging CI if the fork callback regresses.
            import signal

            signal.alarm(5)
            clean = (
                proxy._TRANSPORT is None and proxy._TRANSPORT_LOCK is not parent_lock
            )
            transport = proxy._get_transport()
            clean = clean and transport is not parent_transport
            proxy._close_transport()
            os._exit(0 if clean else 1)
        _, status = os.waitpid(child_pid, 0)
    assert os.waitstatus_to_exitcode(status) == 0
    assert proxy._TRANSPORT is parent_transport
