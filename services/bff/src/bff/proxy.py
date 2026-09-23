from __future__ import annotations

import atexit
import os
import threading
import time
from collections.abc import Callable, Iterable, Mapping
from urllib.parse import urlparse
from urllib.request import getproxies

import httpx
from django.conf import settings

from .security import sign_internal_request

_TOKEN_LOCK = threading.Lock()
_TOKEN_CACHE: dict[str, str | float] = {"token": "", "expires_at": 0.0}
_TRANSPORT_LOCK = threading.Lock()
_TRANSPORT: httpx.HTTPTransport | None = None


def _get_transport() -> httpx.HTTPTransport:
    global _TRANSPORT
    with _TRANSPORT_LOCK:
        if _TRANSPORT is None:
            # Share sockets, never a Client's cookies, headers or auth state.
            _TRANSPORT = httpx.HTTPTransport(
                limits=httpx.Limits(
                    max_connections=100,
                    max_keepalive_connections=20,
                    keepalive_expiry=30.0,
                ),
            )
        return _TRANSPORT


def _close_transport() -> None:
    global _TRANSPORT
    with _TRANSPORT_LOCK:
        transport, _TRANSPORT = _TRANSPORT, None
    if transport is not None:
        transport.close()


def _reset_transport_after_fork() -> None:
    global _TRANSPORT, _TRANSPORT_LOCK
    # An inherited lock may be held by a thread that does not exist in the child.
    # Neither sockets nor locks belonging to the parent can be reused there.
    _TRANSPORT = None
    _TRANSPORT_LOCK = threading.Lock()


class _BorrowedTransport(httpx.BaseTransport):
    def handle_request(self, request: httpx.Request) -> httpx.Response:
        return _get_transport().handle_request(request)

    def close(self) -> None:
        # The worker owns the pool; closing one request must not close it.
        pass


atexit.register(_close_transport)
if hasattr(os, "register_at_fork"):
    os.register_at_fork(after_in_child=_reset_transport_after_fork)


def _filtered_request_headers(
    incoming_headers: Mapping[str, str],
) -> dict[str, str]:
    # Forward only safe headers; avoid leaking cookies/host.
    allowed = {
        "accept",
        "accept-language",
        "content-type",
        "user-agent",
    }
    out: dict[str, str] = {}
    for k, v in incoming_headers.items():
        lk = k.lower()
        if lk in allowed:
            out[k] = v
    forwarded_proto = incoming_headers.get("X-Forwarded-Proto") or incoming_headers.get(
        "x-forwarded-proto"
    )
    out["X-Forwarded-Proto"] = (
        forwarded_proto.split(",", 1)[0].strip() if forwarded_proto else "https"
    )
    return out


def get_httpx_client(timeout: float | None = None) -> httpx.Client:
    if timeout is None:
        timeout = float(getattr(settings, "BFF_PROXY_TIMEOUT_SECONDS", 10))
    # An explicit transport disables HTTPX's automatic proxy routing. Preserve
    # HTTP(S)/ALL_PROXY and NO_PROXY behavior in environments that use a proxy.
    proxies = getproxies()
    if any(proxies.get(scheme) for scheme in ("http", "https", "all")):
        return httpx.Client(timeout=timeout, follow_redirects=False)
    return httpx.Client(
        timeout=timeout, follow_redirects=False, transport=_BorrowedTransport()
    )


def _normalize_base_url(url: str) -> str:
    return url.rstrip("/")


def _requires_private_invoke_auth(upstream_base_url: str) -> bool:
    private_upstreams = {
        _normalize_base_url(url)
        for url in getattr(settings, "BFF_PRIVATE_INVOKE_UPSTREAMS", ())
    }
    return _normalize_base_url(upstream_base_url) in private_upstreams


def _get_iam_token() -> str:
    static_token = str(getattr(settings, "YC_IAM_TOKEN", "") or "").strip()
    if static_token:
        return static_token

    now = time.time()
    cached_token = str(_TOKEN_CACHE.get("token", "") or "").strip()
    cached_expiry = float(_TOKEN_CACHE.get("expires_at", 0.0) or 0.0)
    if cached_token and cached_expiry > now + 60:
        return cached_token

    with _TOKEN_LOCK:
        now = time.time()
        cached_token = str(_TOKEN_CACHE.get("token", "") or "").strip()
        cached_expiry = float(_TOKEN_CACHE.get("expires_at", 0.0) or 0.0)
        if cached_token and cached_expiry > now + 60:
            return cached_token

        metadata_url = str(getattr(settings, "YC_IAM_TOKEN_URL", "") or "").strip()
        if not metadata_url:
            raise RuntimeError("YC_IAM_TOKEN_URL is not configured")

        response = httpx.get(
            metadata_url,
            headers={"Metadata-Flavor": "Google"},
            timeout=3.0,
        )
        response.raise_for_status()
        payload = response.json()
        token = str(payload.get("access_token") or "").strip()
        if not token:
            raise RuntimeError("Metadata service did not return access_token")

        expires_in = float(payload.get("expires_in") or 300)
        _TOKEN_CACHE["token"] = token
        _TOKEN_CACHE["expires_at"] = time.time() + expires_in
        return token


def proxy_request(
    *,
    upstream_base_url: str,
    upstream_path: str,
    method: str,
    query_string: str,
    body: bytes,
    incoming_headers: Mapping[str, str],
    context_headers: dict[str, str],
    request_id: str,
    stream: bool = False,
    timeout: float | None = None,
) -> (
    httpx.Response
    | tuple[httpx.Response, Callable[[], Iterable[bytes]], Callable[[], None]]
):
    url = upstream_base_url.rstrip("/") + "/" + upstream_path.lstrip("/")
    if query_string:
        url = url + ("&" if "?" in url else "?") + query_string

    headers = _filtered_request_headers(incoming_headers)
    headers.update(context_headers)
    if _requires_private_invoke_auth(upstream_base_url):
        headers["Authorization"] = f"Bearer {_get_iam_token()}"

    # signed_path must match the actual path that the target service sees.
    # Extract the path portion from the URL we're actually sending.
    signed_path = urlparse(url.split("?")[0]).path
    if not signed_path.startswith("/"):
        signed_path = "/" + signed_path

    signed = sign_internal_request(
        method=method,
        path=signed_path,
        body=body,
        request_id=request_id,
    )
    headers["X-Updspace-Timestamp"] = signed.timestamp
    headers["X-Updspace-Signature"] = signed.signature

    if stream:
        client = get_httpx_client(timeout=timeout)
        stream_ctx = client.stream(
            method=method,
            url=url,
            content=body,
            headers=headers,
        )
        try:
            resp = stream_ctx.__enter__()
        except BaseException:
            client.close()
            raise
        closed = False

        def iterator() -> Iterable[bytes]:
            try:
                yield from resp.iter_bytes(chunk_size=1024)
            finally:
                close()

        def close() -> None:
            nonlocal closed
            if not closed:
                closed = True
                try:
                    stream_ctx.__exit__(None, None, None)
                finally:
                    client.close()

        return resp, iterator, close

    with get_httpx_client(timeout=timeout) as client:
        resp = client.request(
            method=method,
            url=url,
            content=body,
            headers=headers,
        )
        # Read response content immediately while the client is still open
        # to avoid issues with accessing response data after client closes
        resp.read()
        return resp
