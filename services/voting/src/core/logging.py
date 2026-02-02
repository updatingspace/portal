"""
Custom JSON formatter for structured logging.

Produces JSON log lines with correlation IDs and request context
for easy parsing by log aggregation tools (ELK, Datadog, etc.).
"""

import json
import logging
import traceback
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    """
    Format log records as JSON for structured logging.
    
    Output format:
    {
        "timestamp": "2024-01-15T10:30:00.123456Z",
        "level": "INFO",
        "logger": "tenant_voting.api",
        "message": "Request completed",
        "service": "voting",
        "request_id": "abc123",
        "user_id": "user-uuid",
        "tenant_id": "tenant-uuid",
        ...additional extra fields
    }
    """
    
    # Fields to exclude from extra (already handled specially)
    RESERVED_ATTRS = frozenset({
        "name", "msg", "args", "created", "filename", "funcName",
        "levelname", "levelno", "lineno", "module", "msecs",
        "pathname", "process", "processName", "relativeCreated",
        "stack_info", "exc_info", "exc_text", "thread", "threadName",
        "taskName", "message",
    })
    
    def __init__(self, service_name: str = "voting"):
        super().__init__()
        self.service_name = service_name
    
    def format(self, record: logging.LogRecord) -> str:
        """Format the log record as a JSON string."""
        # Base log structure
        log_dict = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": self.service_name,
        }
        
        # Add location info for errors
        if record.levelno >= logging.ERROR:
            log_dict["location"] = {
                "file": record.filename,
                "line": record.lineno,
                "function": record.funcName,
            }
        
        # Add exception info if present
        if record.exc_info:
            log_dict["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": self._format_traceback(record.exc_info),
            }
        
        # Add extra fields from the log record
        for key, value in record.__dict__.items():
            if key not in self.RESERVED_ATTRS and not key.startswith("_"):
                # Serialize non-JSON-serializable values
                log_dict[key] = self._serialize_value(value)
        
        return json.dumps(log_dict, default=str, ensure_ascii=False)
    
    @staticmethod
    def _format_traceback(exc_info) -> str | None:
        """Format exception traceback as a string."""
        if exc_info and exc_info[2]:
            return "".join(traceback.format_exception(*exc_info))
        return None
    
    @staticmethod
    def _serialize_value(value):
        """Attempt to serialize value to JSON-compatible type."""
        if isinstance(value, (str, int, float, bool, type(None))):
            return value
        if isinstance(value, (list, tuple)):
            return [JsonFormatter._serialize_value(v) for v in value]
        if isinstance(value, dict):
            return {k: JsonFormatter._serialize_value(v) for k, v in value.items()}
        # Fall back to string representation
        return str(value)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger with the given name.
    
    Usage:
        from core.logging import get_logger
        logger = get_logger(__name__)
        logger.info("Operation completed", extra={"user_id": user_id})
    """
    return logging.getLogger(name)


class LogContext:
    """
    Context manager for adding temporary context to log records.
    
    Usage:
        with LogContext(request_id="abc123", user_id="user-uuid"):
            logger.info("Processing request")  # Will include request_id and user_id
    """
    
    _context: dict = {}
    
    def __init__(self, **kwargs):
        self.new_context = kwargs
        self.old_context = {}
    
    def __enter__(self):
        self.old_context = LogContext._context.copy()
        LogContext._context.update(self.new_context)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        LogContext._context = self.old_context
        return False
    
    @classmethod
    def get_context(cls) -> dict:
        """Get the current logging context."""
        return cls._context.copy()
