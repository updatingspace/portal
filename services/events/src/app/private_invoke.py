"""On-demand IAM for configured private container URLs; never caches user permissions.

Kept identical in the five independently built service images. The shared CI
contract in scripts/ci/test_private_invoke.py checks these copies together.
Call only with service URLs from trusted deployment settings, never user input.
"""

from __future__ import annotations

import json
import math
import re
import threading
import time
import urllib.request
from typing import Any
from urllib.parse import urlsplit

_METADATA_URL = (
    "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token"
)
_TOKEN_LOCK = threading.Lock()
_cached_token: tuple[str, float] = ("", 0.0)


class PrivateInvokeError(OSError):
    """The runtime service account credential could not be obtained."""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def urlopen_no_redirect(request: urllib.request.Request, *, timeout: float) -> Any:
    # Do not forward IAM/HMAC credentials through redirects or environment proxies.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect())
    return opener.open(request, timeout=timeout)


def _requires_iam(url: str) -> bool:
    try:
        parsed = urlsplit(url)
        return bool(
            parsed.scheme == "https"
            and parsed.username is None
            and parsed.password is None
            and parsed.port in (None, 443)
            and re.fullmatch(
                r"[a-z0-9-]+\.containers\.yandexcloud\.net", parsed.hostname or ""
            )
        )
    except ValueError:
        return False


def _get_iam_token() -> str:
    global _cached_token
    with _TOKEN_LOCK:
        token, refresh_at = _cached_token
        if token and time.monotonic() < refresh_at:
            return token
        started = time.monotonic()
        request = urllib.request.Request(
            _METADATA_URL, headers={"Metadata-Flavor": "Google"}
        )
        try:
            with urlopen_no_redirect(request, timeout=3.0) as response:
                payload = json.loads(response.read(65536))
            token = payload["access_token"]
            ttl = float(payload["expires_in"])
            if (
                not isinstance(token, str)
                or not token
                or any(ord(char) < 33 or ord(char) > 126 for char in token)
                or not math.isfinite(ttl)
                or ttl <= 0
            ):
                raise ValueError("Invalid credential response")
            refresh_at = started + ttl - min(60.0, ttl * 0.1)
            if refresh_at <= time.monotonic():
                raise ValueError("Expired credential response")
        except (OSError, ValueError, TypeError, KeyError):
            # Do not include the response or credentials in exceptions/logs.
            raise PrivateInvokeError("Runtime IAM credential unavailable") from None
        _cached_token = token, refresh_at
        return token


def private_invoke_headers(url: str) -> dict[str, str]:
    if not _requires_iam(url):
        return {}
    return {"Authorization": f"Bearer {_get_iam_token()}"}
