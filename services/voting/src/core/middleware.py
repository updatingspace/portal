"""
Middleware for Voting Service.

Includes:
- RateLimitMiddleware: Throttle vote operations per user/tenant
- LoggingMiddleware: Add request correlation IDs and structured logging context
"""

import logging
import time
from collections import defaultdict
from threading import Lock

from django.http import HttpRequest, JsonResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class RateLimitMiddleware(MiddlewareMixin):
    """
    In-memory rate limiting middleware for vote operations.
    
    Configuration (in settings.py):
        RATE_LIMIT_ENABLED = True
        RATE_LIMIT_VOTE_WINDOW_SECONDS = 60
        RATE_LIMIT_VOTE_MAX_REQUESTS = 10
        RATE_LIMIT_POLL_CREATE_WINDOW_SECONDS = 300
        RATE_LIMIT_POLL_CREATE_MAX_REQUESTS = 5
    
    Rate limits are per user_id + tenant_id + endpoint.
    Uses sliding window algorithm with in-memory storage.
    
    For production scale, consider Redis-backed implementation.
    """
    
    # Class-level storage for rate limit counters
    _counters: dict[str, list[float]] = defaultdict(list)
    _lock = Lock()
    
    def __init__(self, get_response=None):
        super().__init__(get_response)
        self.enabled = True  # Can be configured from settings
        
        # Vote casting limits
        self.vote_window_seconds = 60
        self.vote_max_requests = 10
        
        # Poll creation limits
        self.poll_create_window_seconds = 300  # 5 minutes
        self.poll_create_max_requests = 5
    
    def process_request(self, request: HttpRequest) -> JsonResponse | None:
        """Check rate limits before processing request."""
        if not self.enabled:
            return None
        
        # Only rate limit specific endpoints
        if not self._should_rate_limit(request):
            return None
        
        # Extract user and tenant info from headers (set by BFF)
        user_id = request.headers.get("X-User-ID")
        tenant_id = request.headers.get("X-Tenant-ID")
        
        if not user_id or not tenant_id:
            # Can't rate limit without user context
            return None
        
        # Determine rate limit config based on endpoint
        window_seconds, max_requests = self._get_limits(request)
        
        # Build rate limit key
        key = f"{user_id}:{tenant_id}:{request.path}"
        
        # Check and update rate limit
        now = time.time()
        with self._lock:
            # Clean old timestamps outside the window
            self._counters[key] = [
                ts for ts in self._counters[key]
                if now - ts < window_seconds
            ]
            
            # Check if limit exceeded
            if len(self._counters[key]) >= max_requests:
                oldest_timestamp = self._counters[key][0]
                retry_after = int(window_seconds - (now - oldest_timestamp))
                
                logger.warning(
                    "Rate limit exceeded",
                    extra={
                        "user_id": user_id,
                        "tenant_id": tenant_id,
                        "path": request.path,
                        "limit": max_requests,
                        "window": window_seconds,
                    }
                )
                
                return JsonResponse(
                    {
                        "error": {
                            "code": "RATE_LIMIT_EXCEEDED",
                            "message": f"Too many requests. Please try again in {retry_after} seconds.",
                            "details": {
                                "retry_after": retry_after,
                                "limit": max_requests,
                                "window": window_seconds,
                            }
                        }
                    },
                    status=429,
                    headers={"Retry-After": str(retry_after)}
                )
            
            # Add current request timestamp
            self._counters[key].append(now)
        
        return None
    
    def _should_rate_limit(self, request: HttpRequest) -> bool:
        """Determine if this endpoint should be rate limited."""
        path = request.path
        method = request.method
        
        # Vote casting endpoints
        if method == "POST" and "/votes" in path and path.endswith("/votes"):
            return True
        
        # Poll creation endpoints
        if method == "POST" and "/polls" in path and path.endswith("/polls"):
            return True
        
        # Option/nomination creation
        if method == "POST" and ("/nominations" in path or "/options" in path):
            return True
        
        return False
    
    def _get_limits(self, request: HttpRequest) -> tuple[int, int]:
        """Get (window_seconds, max_requests) for the endpoint."""
        path = request.path
        
        # Vote endpoints get stricter limits
        if "/votes" in path:
            return self.vote_window_seconds, self.vote_max_requests
        
        # Poll/nomination/option creation
        return self.poll_create_window_seconds, self.poll_create_max_requests
    
    @classmethod
    def clear_counters(cls):
        """Clear all rate limit counters (useful for testing)."""
        with cls._lock:
            cls._counters.clear()


class LoggingMiddleware(MiddlewareMixin):
    """
    Add correlation IDs and structured logging context to requests.
    
    Extracts X-Request-ID header from BFF and adds it to log records.
    Logs request/response metadata for observability.
    """
    
    def process_request(self, request: HttpRequest) -> None:
        """Attach request context to logger."""
        request_id = request.headers.get("X-Request-ID", "")
        user_id = request.headers.get("X-User-ID", "")
        tenant_id = request.headers.get("X-Tenant-ID", "")
        tenant_slug = request.headers.get("X-Tenant-Slug", "")
        
        # Store in request for access in views
        request.correlation_id = request_id
        request.start_time = time.time()
        
        # Create log context
        log_context = {
            "request_id": request_id,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "tenant_slug": tenant_slug,
            "method": request.method,
            "path": request.path,
            "remote_addr": self._get_client_ip(request),
        }
        
        # Store context in request for views to extend
        request.log_context = log_context
        
        logger.info(
            "Request started",
            extra=log_context
        )
    
    def process_response(self, request: HttpRequest, response):
        """Log response metadata."""
        if not hasattr(request, "start_time"):
            return response
        
        duration_ms = (time.time() - request.start_time) * 1000
        
        log_context = getattr(request, "log_context", {})
        log_context.update({
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2),
        })
        
        # Add correlation ID to response header
        if hasattr(request, "correlation_id") and request.correlation_id:
            response["X-Request-ID"] = request.correlation_id
        
        logger.info(
            "Request completed",
            extra=log_context
        )
        
        return response
    
    def process_exception(self, request: HttpRequest, exception: Exception) -> None:
        """Log exceptions with context."""
        log_context = getattr(request, "log_context", {})
        log_context.update({
            "exception_type": type(exception).__name__,
            "exception_message": str(exception),
        })
        
        logger.error(
            "Request failed with exception",
            extra=log_context,
            exc_info=True
        )
    
    @staticmethod
    def _get_client_ip(request: HttpRequest) -> str:
        """Extract client IP from request."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")
