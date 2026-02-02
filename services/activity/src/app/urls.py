from django.http import JsonResponse
from django.urls import path
from ninja import NinjaAPI
from ninja.errors import HttpError
from activity.api import router as activity_router
from activity.health import liveness_check, readiness_check, metrics_endpoint
from activity.sse import sse_unread_count


def _error_response(request, *, status: int, code: str, message: str, details: dict | None = None):
    request_id = request.headers.get("X-Request-Id")
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


api = NinjaAPI(title="Activity Service API", version="1")


@api.exception_handler(HttpError)
def on_http_error(request, exc: HttpError):
    status = getattr(exc, "status_code", 500)
    detail = getattr(exc, "message", None)
    if isinstance(detail, dict):
        code = str(detail.get("code") or "HTTP_ERROR")
        msg = str(detail.get("message") or "Request failed")
        raw_details = detail.get("details")
        details = raw_details if isinstance(raw_details, dict) else {}
        return _error_response(request, status=status, code=code, message=msg, details=details)
    msg = str(detail) if detail else "Request failed"
    return _error_response(request, status=status, code="HTTP_ERROR", message=msg)


# Routes at root level (BFF prefixes with /activity/ or /feed/)
api.add_router("", activity_router)

urlpatterns = [
    path("api/v1/", api.urls),
    path("api/v1/feed/sse", sse_unread_count),  # SSE outside ninja for streaming
    path("health", liveness_check),
    path("readiness", readiness_check),
    path("metrics", metrics_endpoint),
]
