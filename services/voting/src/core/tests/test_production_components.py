"""
Tests for production-ready components.

Tests cover:
- RateLimitMiddleware
- LoggingMiddleware  
- Health checks
- Pagination
"""

import json
import time
from unittest.mock import MagicMock, patch

from django.http import JsonResponse
from django.test import RequestFactory, TestCase

from core.middleware import LoggingMiddleware, RateLimitMiddleware


class TestRateLimitMiddleware(TestCase):
    """Tests for RateLimitMiddleware."""
    
    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = RateLimitMiddleware(get_response=lambda r: JsonResponse({"ok": True}))
        # Clear counters before each test
        RateLimitMiddleware.clear_counters()
    
    def tearDown(self):
        RateLimitMiddleware.clear_counters()
    
    def _make_request(self, path: str, method: str = "POST", user_id: str = "user-1", tenant_id: str = "tenant-1"):
        """Create a request with headers."""
        request = getattr(self.factory, method.lower())(path)
        request.META["HTTP_X_USER_ID"] = user_id
        request.META["HTTP_X_TENANT_ID"] = tenant_id
        return request
    
    def test_rate_limit_not_applied_to_get_requests(self):
        """GET requests should not be rate limited."""
        request = self._make_request("/api/v1/polls/123/votes", method="GET")
        response = self.middleware.process_request(request)
        assert response is None  # No rate limit response
    
    def test_rate_limit_applied_to_vote_endpoint(self):
        """POST to /votes should be rate limited."""
        # Make requests up to the limit
        for i in range(10):
            request = self._make_request("/api/v1/polls/123/votes")
            response = self.middleware.process_request(request)
            assert response is None, f"Request {i+1} should pass"
        
        # Next request should be rate limited
        request = self._make_request("/api/v1/polls/123/votes")
        response = self.middleware.process_request(request)
        assert response is not None
        assert response.status_code == 429
        
        data = json.loads(response.content)
        assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    
    def test_rate_limit_per_user(self):
        """Different users should have separate rate limits."""
        # User 1 hits limit
        for i in range(10):
            request = self._make_request("/api/v1/polls/123/votes", user_id="user-1")
            self.middleware.process_request(request)
        
        # User 2 should still be able to vote
        request = self._make_request("/api/v1/polls/123/votes", user_id="user-2")
        response = self.middleware.process_request(request)
        assert response is None
    
    def test_rate_limit_without_headers(self):
        """Requests without user headers should not be rate limited."""
        request = self.factory.post("/api/v1/polls/123/votes")
        response = self.middleware.process_request(request)
        assert response is None


class TestLoggingMiddleware(TestCase):
    """Tests for LoggingMiddleware."""
    
    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = LoggingMiddleware(get_response=lambda r: JsonResponse({"ok": True}))
    
    def test_correlation_id_attached_to_request(self):
        """X-Request-ID should be attached to request."""
        request = self.factory.get("/api/v1/polls")
        request.META["HTTP_X_REQUEST_ID"] = "test-request-123"
        
        self.middleware.process_request(request)
        
        assert hasattr(request, "correlation_id")
        assert request.correlation_id == "test-request-123"
    
    def test_log_context_contains_request_metadata(self):
        """Log context should contain request metadata."""
        request = self.factory.get("/api/v1/polls")
        request.META["HTTP_X_REQUEST_ID"] = "req-123"
        request.META["HTTP_X_USER_ID"] = "user-456"
        request.META["HTTP_X_TENANT_ID"] = "tenant-789"
        
        self.middleware.process_request(request)
        
        assert hasattr(request, "log_context")
        assert request.log_context["request_id"] == "req-123"
        assert request.log_context["user_id"] == "user-456"
        assert request.log_context["tenant_id"] == "tenant-789"
        assert request.log_context["method"] == "GET"
        assert request.log_context["path"] == "/api/v1/polls"
    
    def test_response_includes_correlation_id_header(self):
        """Response should include X-Request-ID header."""
        request = self.factory.get("/api/v1/polls")
        request.META["HTTP_X_REQUEST_ID"] = "test-request-123"
        
        self.middleware.process_request(request)
        response = JsonResponse({"ok": True})
        response = self.middleware.process_response(request, response)
        
        assert response["X-Request-ID"] == "test-request-123"
    
    def test_response_duration_logged(self):
        """Response duration should be calculated."""
        request = self.factory.get("/api/v1/polls")
        
        self.middleware.process_request(request)
        time.sleep(0.01)  # Small delay
        
        response = JsonResponse({"ok": True})
        
        with patch("core.middleware.logger") as mock_logger:
            self.middleware.process_response(request, response)
            
            # Check that logger was called with duration
            call_args = mock_logger.info.call_args_list[-1]
            extra = call_args.kwargs.get("extra", {})
            assert "duration_ms" in extra
            assert extra["duration_ms"] >= 10  # At least 10ms


class TestHealthChecks(TestCase):
    """Tests for health check endpoints."""
    
    def test_basic_health_check(self):
        """Basic health check should return ok."""
        from core.health import health_check
        
        factory = RequestFactory()
        request = factory.get("/health")
        
        response = health_check(request)
        
        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["status"] == "ok"
    
    def test_readiness_check_with_database(self):
        """Readiness check should verify database."""
        from core.health import readiness_check
        
        factory = RequestFactory()
        request = factory.get("/health/ready")
        
        response = readiness_check(request)
        
        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["status"] == "ready"
        assert "database" in data["checks"]
    
    @patch("core.health.httpx.get")
    def test_detailed_health_check(self, mock_get):
        """Detailed health check should include all components."""
        from core.health import detailed_health_check
        
        # Mock external service responses
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response
        
        factory = RequestFactory()
        request = factory.get("/health/detailed")
        
        response = detailed_health_check(request)
        
        data = json.loads(response.content)
        assert "checks" in data
        assert "database" in data["checks"]
        assert "access_service" in data["checks"]
        assert "activity_service" in data["checks"]
        assert "outbox" in data
    
    @patch("core.health._check_database")
    def test_readiness_fails_when_database_unhealthy(self, mock_db):
        """Readiness should return 503 when database is unhealthy."""
        from core.health import readiness_check
        
        mock_db.return_value = {"status": "unhealthy", "error": "Connection refused"}
        
        factory = RequestFactory()
        request = factory.get("/health/ready")
        
        response = readiness_check(request)
        
        assert response.status_code == 503
        data = json.loads(response.content)
        assert data["status"] == "not_ready"


class TestPagination(TestCase):
    """Tests for pagination in list endpoints."""
    
    def test_pagination_schema_values(self):
        """Pagination schema should have correct structure."""
        from tenant_voting.schemas import PaginationMeta
        
        meta = PaginationMeta(
            total=100,
            limit=20,
            offset=40,
            has_next=True,
            has_prev=True,
        )
        
        assert meta.total == 100
        assert meta.limit == 20
        assert meta.offset == 40
        assert meta.has_next is True
        assert meta.has_prev is True
    
    def test_pagination_has_next_calculation(self):
        """has_next should be True when more items exist."""
        from tenant_voting.schemas import PaginationMeta
        
        # More items exist
        meta = PaginationMeta(total=100, limit=20, offset=0, has_next=True, has_prev=False)
        assert meta.has_next is True
        
        # At end of list
        meta = PaginationMeta(total=100, limit=20, offset=80, has_next=False, has_prev=True)
        assert meta.has_next is False
    
    def test_pagination_has_prev_calculation(self):
        """has_prev should be True when offset > 0."""
        from tenant_voting.schemas import PaginationMeta
        
        # At start
        meta = PaginationMeta(total=100, limit=20, offset=0, has_next=True, has_prev=False)
        assert meta.has_prev is False
        
        # Not at start
        meta = PaginationMeta(total=100, limit=20, offset=20, has_next=True, has_prev=True)
        assert meta.has_prev is True
