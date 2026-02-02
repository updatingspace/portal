from __future__ import annotations

from typing import Callable, Iterable, Mapping
from urllib.parse import urlparse

import httpx
from django.conf import settings

from .security import sign_internal_request


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
    return out


def get_httpx_client(timeout: float | None = None) -> httpx.Client:
    if timeout is None:
        timeout = float(getattr(settings, "BFF_PROXY_TIMEOUT_SECONDS", 10))
    return httpx.Client(timeout=timeout, follow_redirects=False)


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
) -> httpx.Response | tuple[httpx.Response, Callable[[], Iterable[bytes]], Callable[[], None]]:
    url = upstream_base_url.rstrip("/") + "/" + upstream_path.lstrip("/")
    if query_string:
        url = url + ("&" if "?" in url else "?") + query_string

    headers = _filtered_request_headers(incoming_headers)
    headers.update(context_headers)

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
        client = get_httpx_client(timeout=None)
        stream_ctx = client.stream(
            method=method,
            url=url,
            content=body,
            headers=headers,
        )
        resp = stream_ctx.__enter__()

        def iterator() -> Iterable[bytes]:
            try:
                for chunk in resp.iter_bytes(chunk_size=1024):
                    yield chunk
            finally:
                close()

        def close() -> None:
            resp.close()
            stream_ctx.__exit__(None, None, None)
            client.close()

        return resp, iterator, close

    with get_httpx_client() as client:
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

