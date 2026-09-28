from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from functools import wraps
from typing import Concatenate, ParamSpec

from django.http import HttpRequest, HttpResponseBase, JsonResponse
from ninja.errors import HttpError

P = ParamSpec("P")


@dataclass(frozen=True)
class ErrorEnvelope:
    code: str
    message: str
    details: dict | None = None


def error_payload(code: str, message: str, details: dict | None = None) -> dict:
    payload: dict = {"code": code, "message": message}
    if details is not None:
        payload["details"] = details
    return payload


def http_error_payload(exc: HttpError, request_id: str) -> dict:
    detail = exc.message if isinstance(exc.message, dict) else {}
    return {
        "code": detail.get("code", "HTTP_ERROR"),
        "message": detail.get("message", "Request failed"),
        "details": detail.get("details", {}),
        "request_id": request_id,
    }


def http_errors(
    view: Callable[Concatenate[HttpRequest, P], HttpResponseBase],
) -> Callable[Concatenate[HttpRequest, P], HttpResponseBase]:
    @wraps(view)
    def wrapped(
        request: HttpRequest, *args: P.args, **kwargs: P.kwargs
    ) -> HttpResponseBase:
        try:
            return view(request, *args, **kwargs)
        except HttpError as exc:
            return JsonResponse(
                {
                    "error": http_error_payload(
                        exc, request.headers.get("X-Request-Id", "")
                    )
                },
                status=exc.status_code,
            )

    return wrapped
