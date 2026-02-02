"""
Health check endpoints for Voting Service.

Provides:
- /health - Basic liveness check
- /health/ready - Readiness check with dependency verification
- /health/detailed - Detailed status of all components
"""

import logging
import time
from typing import Any

import httpx
from django.conf import settings
from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def _check_database() -> dict[str, Any]:
    """Check database connectivity."""
    start = time.time()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        duration_ms = (time.time() - start) * 1000
        return {
            "status": "healthy",
            "latency_ms": round(duration_ms, 2),
        }
    except Exception as e:
        duration_ms = (time.time() - start) * 1000
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "unhealthy",
            "latency_ms": round(duration_ms, 2),
            "error": str(e),
        }


def _check_access_service() -> dict[str, Any]:
    """Check Access service connectivity."""
    base_url = getattr(settings, "ACCESS_BASE_URL", "http://access:8002/api/v1")
    # Assume Access service has a health endpoint
    health_url = base_url.replace("/api/v1", "") + "/health"
    
    start = time.time()
    try:
        response = httpx.get(health_url, timeout=3.0)
        duration_ms = (time.time() - start) * 1000
        
        if response.status_code == 200:
            return {
                "status": "healthy",
                "latency_ms": round(duration_ms, 2),
            }
        else:
            return {
                "status": "degraded",
                "latency_ms": round(duration_ms, 2),
                "http_status": response.status_code,
            }
    except httpx.TimeoutException:
        duration_ms = (time.time() - start) * 1000
        logger.warning(f"Access service health check timed out after {duration_ms}ms")
        return {
            "status": "unhealthy",
            "latency_ms": round(duration_ms, 2),
            "error": "Connection timed out",
        }
    except Exception as e:
        duration_ms = (time.time() - start) * 1000
        logger.warning(f"Access service health check failed: {e}")
        return {
            "status": "unhealthy",
            "latency_ms": round(duration_ms, 2),
            "error": str(e),
        }


def _check_activity_service() -> dict[str, Any]:
    """Check Activity service connectivity (for outbox publishing)."""
    activity_url = getattr(settings, "ACTIVITY_SERVICE_URL", "http://activity:8006/api/v1")
    health_url = activity_url.replace("/api/v1", "") + "/health"
    
    start = time.time()
    try:
        response = httpx.get(health_url, timeout=3.0)
        duration_ms = (time.time() - start) * 1000
        
        if response.status_code == 200:
            return {
                "status": "healthy",
                "latency_ms": round(duration_ms, 2),
            }
        else:
            return {
                "status": "degraded",
                "latency_ms": round(duration_ms, 2),
                "http_status": response.status_code,
            }
    except httpx.TimeoutException:
        duration_ms = (time.time() - start) * 1000
        return {
            "status": "unhealthy",
            "latency_ms": round(duration_ms, 2),
            "error": "Connection timed out",
        }
    except Exception as e:
        duration_ms = (time.time() - start) * 1000
        return {
            "status": "unhealthy",
            "latency_ms": round(duration_ms, 2),
            "error": str(e),
        }


def _get_outbox_stats() -> dict[str, Any]:
    """Get outbox message statistics."""
    try:
        from tenant_voting.models import OutboxMessage
        from django.db.models import Count
        from django.utils import timezone
        from datetime import timedelta
        
        now = timezone.now()
        one_hour_ago = now - timedelta(hours=1)
        
        total_unpublished = OutboxMessage.objects.filter(
            published_at__isnull=True
        ).count()
        
        recent_published = OutboxMessage.objects.filter(
            published_at__gte=one_hour_ago
        ).count()
        
        oldest_unpublished = OutboxMessage.objects.filter(
            published_at__isnull=True
        ).order_by("occurred_at").first()
        
        result = {
            "unpublished_count": total_unpublished,
            "published_last_hour": recent_published,
        }
        
        if oldest_unpublished:
            age_seconds = (now - oldest_unpublished.occurred_at).total_seconds()
            result["oldest_unpublished_age_seconds"] = int(age_seconds)
            
            # Warn if messages are backing up
            if age_seconds > 300:  # 5 minutes
                result["warning"] = "Outbox messages backing up"
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to get outbox stats: {e}")
        return {"error": str(e)}


def health_check(request) -> JsonResponse:
    """
    Basic liveness check.
    Returns 200 if the service is running.
    """
    return JsonResponse({"status": "ok"})


def readiness_check(request) -> JsonResponse:
    """
    Readiness check with database connectivity.
    Returns 200 if the service can handle requests.
    Returns 503 if critical dependencies are unavailable.
    """
    db_status = _check_database()
    
    is_ready = db_status["status"] == "healthy"
    
    response_data = {
        "status": "ready" if is_ready else "not_ready",
        "checks": {
            "database": db_status,
        },
    }
    
    status_code = 200 if is_ready else 503
    return JsonResponse(response_data, status=status_code)


def detailed_health_check(request) -> JsonResponse:
    """
    Detailed health check with all dependencies.
    Returns comprehensive status of all components.
    
    Note: This endpoint may be slow due to external service checks.
    Consider caching results or using for debugging only.
    """
    start_time = time.time()
    
    # Check all components
    db_status = _check_database()
    access_status = _check_access_service()
    activity_status = _check_activity_service()
    outbox_stats = _get_outbox_stats()
    
    # Determine overall status
    statuses = [
        db_status.get("status"),
        access_status.get("status"),
    ]
    
    if all(s == "healthy" for s in statuses):
        overall_status = "healthy"
        status_code = 200
    elif db_status.get("status") != "healthy":
        overall_status = "unhealthy"
        status_code = 503
    else:
        overall_status = "degraded"
        status_code = 200
    
    total_time_ms = (time.time() - start_time) * 1000
    
    response_data = {
        "status": overall_status,
        "service": "voting",
        "version": "1.0.0",
        "checks": {
            "database": db_status,
            "access_service": access_status,
            "activity_service": activity_status,
        },
        "outbox": outbox_stats,
        "total_check_time_ms": round(total_time_ms, 2),
    }
    
    return JsonResponse(response_data, status=status_code)
