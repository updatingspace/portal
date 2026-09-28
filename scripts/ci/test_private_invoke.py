"""Run once from Portal's CI job; exercise each independently packaged helper."""

from __future__ import annotations

import importlib.util
import io
import json
import threading
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from unittest.mock import Mock

import pytest

SERVICES = ("portal", "activity", "events", "gamification", "voting")
ROOT = Path(__file__).resolve().parents[2]
PRIVATE_URL = "https://bba123.containers.yandexcloud.net/api/v1/access/check"


@pytest.fixture(params=SERVICES)
def runtime(request):
    spec = importlib.util.spec_from_file_location(
        f"private_invoke_{request.param}",
        ROOT / f"services/{request.param}/src/app/private_invoke.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def metadata_response(token="test-runtime-token", ttl=3600):
    return io.BytesIO(json.dumps({"access_token": token, "expires_in": ttl}).encode())


def test_packaged_helpers_are_identical():
    copies = [
        (ROOT / f"services/{s}/src/app/private_invoke.py").read_bytes()
        for s in SERVICES
    ]
    assert all(copy == copies[0] for copy in copies)


@pytest.mark.parametrize(
    "url",
    [
        "http://access:8002/api/v1",
        "https://id.updspace.com/api/v1",
        "http://bba123.containers.yandexcloud.net/api/v1",
        "https://bba123.containers.yandexcloud.net.evil.test/api/v1",
        "https://bba123.evil.containers.yandexcloud.net/api/v1",
        "https://bba123.containers.yandexcloud.net:444/api/v1",
        "https://user@bba123.containers.yandexcloud.net/api/v1",
        "https://bba123.containers.yandexcloud.net:bad/api/v1",
        "https://steamcommunity.com/profiles/123",
        "https://[invalid",
    ],
)
def test_no_runtime_credential_on_local_or_external_urls(runtime, monkeypatch, url):
    fetch = Mock(side_effect=AssertionError("Metadata must not be called"))
    monkeypatch.setattr(runtime, "urlopen_no_redirect", fetch)
    assert runtime.private_invoke_headers(url) == {}
    fetch.assert_not_called()


def test_token_is_reused_and_refreshed_before_expiry(runtime, monkeypatch):
    now = [100.0]
    monkeypatch.setattr(runtime.time, "monotonic", lambda: now[0])
    fetch = Mock(
        side_effect=[metadata_response("first", 120), metadata_response("second", 120)]
    )
    monkeypatch.setattr(runtime, "urlopen_no_redirect", fetch)
    assert runtime.private_invoke_headers(PRIVATE_URL) == {
        "Authorization": "Bearer first"
    }
    now[0] = 207.0
    assert runtime.private_invoke_headers(PRIVATE_URL + "/other") == {
        "Authorization": "Bearer first"
    }
    assert fetch.call_count == 1
    now[0] = 208.0
    assert runtime.private_invoke_headers(PRIVATE_URL) == {
        "Authorization": "Bearer second"
    }
    assert fetch.call_count == 2
    request = fetch.call_args.args[0]
    assert request.full_url == runtime._METADATA_URL
    assert request.get_header("Metadata-flavor") == "Google"
    assert fetch.call_args.kwargs["timeout"] == 3.0


def test_concurrent_requests_fetch_one_token(runtime, monkeypatch):
    fetch = Mock(side_effect=lambda *args, **kwargs: metadata_response())
    monkeypatch.setattr(runtime, "urlopen_no_redirect", fetch)
    barrier = threading.Barrier(8)

    def invoke(_):
        barrier.wait(timeout=5)
        return runtime.private_invoke_headers(PRIVATE_URL)

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(invoke, range(8)))
    assert results == [{"Authorization": "Bearer test-runtime-token"}] * 8
    fetch.assert_called_once()


@pytest.mark.parametrize(
    "payload",
    [
        {},
        [],
        None,
        {"access_token": "secret"},
        {"access_token": "", "expires_in": 120},
        {"access_token": "secret\nheader", "expires_in": 120},
        {"access_token": 123, "expires_in": 120},
        {"access_token": "secret", "expires_in": 0},
        {"access_token": "secret", "expires_in": -1},
        {"access_token": "secret", "expires_in": "NaN"},
        {"access_token": "secret", "expires_in": "Infinity"},
    ],
)
def test_invalid_credentials_fail_closed_without_leaking_response(
    runtime, monkeypatch, payload
):
    monkeypatch.setattr(
        runtime,
        "urlopen_no_redirect",
        Mock(return_value=io.BytesIO(json.dumps(payload).encode())),
    )
    with pytest.raises(
        runtime.PrivateInvokeError, match="^Runtime IAM credential unavailable$"
    ):
        runtime.private_invoke_headers(PRIVATE_URL)
    assert runtime._cached_token == ("", 0.0)


def test_failed_refresh_does_not_return_expired_token(runtime, monkeypatch):
    runtime._cached_token = ("expired-secret", 99.0)
    monkeypatch.setattr(runtime.time, "monotonic", lambda: 100.0)
    monkeypatch.setattr(
        runtime, "urlopen_no_redirect", Mock(side_effect=OSError("secret-body"))
    )
    with pytest.raises(
        runtime.PrivateInvokeError, match="^Runtime IAM credential unavailable$"
    ):
        runtime.private_invoke_headers(PRIVATE_URL)


@pytest.mark.parametrize("status", [301, 302, 303, 307, 308])
def test_transport_does_not_follow_redirects_with_credentials(runtime, status):
    seen = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            seen.append(self.path)
            self.send_response(status if self.path == "/source" else 200)
            self.send_header("Location", "/destination")
            self.end_headers()

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(
        target=lambda: server.serve_forever(poll_interval=0.01), daemon=True
    )
    thread.start()
    try:
        request = urllib.request.Request(
            f"http://127.0.0.1:{server.server_port}/source",
            headers={"Authorization": "Bearer test"},
        )
        with pytest.raises(urllib.error.HTTPError) as error:
            runtime.urlopen_no_redirect(request, timeout=2)
        assert error.value.code == status
        error.value.close()
        assert seen == ["/source"]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
