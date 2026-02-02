"""
Health checks and readiness probes for Activity service.

Provides:
- /health - basic liveness probe
- /readiness - comprehensive readiness check (DB, Access service)
- /metrics - Prometheus-style metrics (placeholder)
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import httpx
from django.conf import settings
from django.db import connection
from django.http import JsonResponse

from activity.models import Outbox

logger = logging.getLogger(__name__)


@dataclass
class CheckResult:
    """Result of a health check."""

    name: str
    status: str  # "ok", "degraded", "error"
    latency_ms: float = 0.0
    message: str = ""
    details: dict[str, Any] = field(default_factory=dict)


def _check_database() -> CheckResult:
    """Check database connectivity and performance."""
    start = time.perf_counter()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        latency = (time.perf_counter() - start) * 1000

        # Check for pending outbox events (sign of processing issues)
        pending_outbox = Outbox.objects.filter(processed_at__isnull=True).count()

        status = "ok"
        if latency > 100:
            status = "degraded"
        if latency > 500:
            status = "error"

        return CheckResult(
            name="database",
            status=status,
            latency_ms=round(latency, 2),
            message="Database connection OK",
            details={
                "pending_outbox_events": pending_outbox,
            },
        )
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        logger.exception("Database health check failed")
        return CheckResult(
            name="database",
            status="error",
            latency_ms=round(latency, 2),
            message=f"Database error: {e}",
        )


def _check_access_service() -> CheckResult:
    """Check Access service connectivity."""
    access_url = getattr(settings, "ACCESS_SERVICE_URL", "http://access:8002")
    start = time.perf_counter()

    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(f"{access_url}/health")
            latency = (time.perf_counter() - start) * 1000

            if resp.status_code == 200:
                status = "ok" if latency < 100 else "degraded"
                return CheckResult(
                    name="access_service",
                    status=status,
                    latency_ms=round(latency, 2),
                    message="Access service reachable",
                )
            else:
                return CheckResult(
                    name="access_service",
                    status="degraded",
                    latency_ms=round(latency, 2),
                    message=f"Access service returned {resp.status_code}",
                )
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        logger.warning("Access service health check failed: %s", e)
        return CheckResult(
            name="access_service",
            status="error",
            latency_ms=round(latency, 2),
            message=f"Access service unreachable: {e}",
        )


def liveness_check(request) -> JsonResponse:
    """
    Basic liveness probe - just confirms the service is running.

    Used by: Kubernetes liveness probe
    """
    return JsonResponse({
        "status": "ok",
        "service": "activity",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


def readiness_check(request) -> JsonResponse:
    """
    Comprehensive readiness probe - checks all dependencies.

    Used by: Kubernetes readiness probe, load balancer
    """
    checks: list[CheckResult] = []

    # Always check database
    checks.append(_check_database())

    # Optional: check Access service (don't fail readiness if unavailable)
    try:
        checks.append(_check_access_service())
    except Exception:
        pass

    # Determine overall status
    statuses = [c.status for c in checks]
    if "error" in statuses:
        overall_status = "error"
        http_status = 503
    elif "degraded" in statuses:
        overall_status = "degraded"
        http_status = 200
    else:
        overall_status = "ok"
        http_status = 200

    return JsonResponse(
        {
            "status": overall_status,
            "service": "activity",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": [
                {
                    "name": c.name,
                    "status": c.status,
                    "latency_ms": c.latency_ms,
                    "message": c.message,
                    "details": c.details,
                }
                for c in checks
            ],
        },
        status=http_status,
    )


def metrics_endpoint(request) -> JsonResponse:
    """
    Prometheus-style metrics endpoint (placeholder).

    For full Prometheus integration, use django-prometheus library.
    This provides basic JSON metrics for monitoring dashboards.
    """
    from activity.models import ActivityEvent, RawEvent, AccountLink

    # Basic counts
    metrics = {
        "activity_events_total": ActivityEvent.objects.count(),
        "raw_events_total": RawEvent.objects.count(),
        "account_links_total": AccountLink.objects.count(),
        "outbox_pending": Outbox.objects.filter(processed_at__isnull=True).count(),
        "outbox_failed": Outbox.objects.filter(
            processed_at__isnull=True,
            retry_count__gt=0,
        ).count(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    return JsonResponse(metrics)
