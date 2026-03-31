from __future__ import annotations

from typing import Any

from django.conf import settings
from django.http import HttpRequest, HttpResponse

from .errors import error_response


def csrf_failure(request: HttpRequest, reason: str = "") -> HttpResponse:
    details: dict[str, Any] | None = None
    if getattr(settings, "DEBUG", False) and reason:
        details = {"reason": reason}

    return error_response(
        code="CSRF_FAILED",
        message="CSRF token missing or invalid",
        request_id=getattr(request, "request_id", None),
        status=403,
        details=details,
    )
