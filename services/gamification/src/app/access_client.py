"""Access transport: reuse sockets, isolate request state, never cache decisions."""

from __future__ import annotations

import atexit
import logging
import math
import os
import threading
from typing import NoReturn
from urllib.request import getproxies

import httpx
from django.conf import settings
from ninja.errors import HttpError

from app.private_invoke import PrivateInvokeError, private_invoke_headers
from core.errors import error_payload

logger = logging.getLogger(__name__)
_transport: httpx.HTTPTransport | None = None
_transport_lock = threading.Lock()


def _get_transport() -> httpx.HTTPTransport:
    global _transport
    with _transport_lock:
        if _transport is None:
            _transport = httpx.HTTPTransport(
                limits=httpx.Limits(
                    max_connections=32,
                    max_keepalive_connections=8,
                    keepalive_expiry=30.0,
                ),
            )
        return _transport


def _close_transport() -> None:
    global _transport
    with _transport_lock:
        transport, _transport = _transport, None
    if transport is not None:
        transport.close()


def _reset_after_fork() -> None:
    global _transport, _transport_lock
    _transport = None
    _transport_lock = threading.Lock()


class _BorrowedTransport(httpx.BaseTransport):
    def handle_request(self, request: httpx.Request) -> httpx.Response:
        return _get_transport().handle_request(request)

    def close(self) -> None:
        # The worker owns the pool; an individual request must not close it.
        pass


atexit.register(_close_transport)
if hasattr(os, "register_at_fork"):
    os.register_at_fork(after_in_child=_reset_after_fork)


def _timeout() -> httpx.Timeout:
    raw = getattr(
        settings,
        "ACCESS_CHECK_TIMEOUT_SECONDS",
        os.getenv("ACCESS_CHECK_TIMEOUT_SECONDS", "15"),
    )
    try:
        read = float(raw)
    except (TypeError, ValueError):
        read = 15.0
    if not math.isfinite(read) or not 0 < read <= 30:
        read = 15.0
    return httpx.Timeout(connect=3.0, read=read, write=5.0, pool=1.0)


def _client() -> httpx.Client:
    # Preserve explicit HTTP proxy routing in environments which require it.
    proxies = getproxies()
    if any(proxies.get(scheme) for scheme in ("http", "https", "all")):
        return httpx.Client(timeout=_timeout(), follow_redirects=False)
    return httpx.Client(
        timeout=_timeout(), follow_redirects=False, transport=_BorrowedTransport()
    )


def unavailable(*, request_id: str, reason: str) -> NoReturn:
    logger.warning(
        "Access check unavailable",
        extra={"request_id": request_id, "reason": reason},
    )
    raise HttpError(
        503, error_payload("ACCESS_UNAVAILABLE", "Access service unavailable")
    )


def check_access(*, url: str, body: bytes, headers: dict[str, str]) -> bool:
    request_id = headers.get("X-Request-Id", "")
    try:
        signed_headers = {**headers, **private_invoke_headers(url)}
        # Each request has its own cookies/headers/auth. Only sockets are shared.
        with _client() as client:
            response = client.post(url, content=body, headers=signed_headers)
    except (httpx.HTTPError, httpx.InvalidURL, PrivateInvokeError) as exc:
        unavailable(request_id=request_id, reason=type(exc).__name__)
    if response.status_code != 200:
        unavailable(request_id=request_id, reason=f"status_{response.status_code}")
    try:
        data = response.json()
    except ValueError:
        unavailable(request_id=request_id, reason="invalid_json")
    if not isinstance(data, dict) or type(data.get("allowed")) is not bool:
        unavailable(request_id=request_id, reason="invalid_decision")
    return data["allowed"]
