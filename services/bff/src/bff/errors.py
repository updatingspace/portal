from __future__ import annotations

from typing import Any

from django.http import JsonResponse


def error_response(
    *,
    code: str,
    message: str,
    request_id: str | None,
    status: int,
    details: dict[str, Any] | None = None,
) -> JsonResponse:
    return JsonResponse(
        {
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "request_id": request_id,
            }
        },
        status=status,
    )
