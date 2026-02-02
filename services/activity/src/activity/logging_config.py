"""
Structured JSON logging configuration for Activity service.

Provides production-ready JSON log formatting for log aggregation systems
like ELK, Loki, or CloudWatch.
"""

from __future__ import annotations

import json
import logging
import traceback
from datetime import datetime, timezone
from typing import Any


class JsonFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.

    Outputs logs in JSON format suitable for log aggregation systems.
    Each log record includes:
    - timestamp: ISO 8601 format
    - level: log level name
    - logger: logger name
    - message: log message
    - service: service name (activity)
    - module/function/line: source location
    - exception: formatted traceback if present
    - extra: any additional fields passed to the logger
    """

    RESERVED_ATTRS = {
        "args",
        "asctime",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "module",
        "msecs",
        "message",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "thread",
        "threadName",
    }

    def __init__(self, service_name: str = "activity"):
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        log_record: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": self.service_name,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add exception info if present
        if record.exc_info:
            log_record["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": traceback.format_exception(*record.exc_info),
            }

        # Add any extra fields
        for key, value in record.__dict__.items():
            if key not in self.RESERVED_ATTRS:
                try:
                    # Try to serialize the value
                    json.dumps(value)
                    log_record[key] = value
                except (TypeError, ValueError):
                    log_record[key] = str(value)

        return json.dumps(log_record, default=str)


def get_request_logger(request_id: str, tenant_id: str | None = None) -> logging.LoggerAdapter:
    """
    Get a logger adapter with request context.

    Usage:
        logger = get_request_logger(ctx.request_id, ctx.tenant_id)
        logger.info("Processing request", extra={"user_id": str(ctx.user_id)})

    Args:
        request_id: Unique request ID for tracing
        tenant_id: Optional tenant ID for multi-tenant context

    Returns:
        LoggerAdapter with pre-filled context
    """
    logger = logging.getLogger("activity")
    extra = {
        "request_id": request_id,
    }
    if tenant_id:
        extra["tenant_id"] = tenant_id

    return logging.LoggerAdapter(logger, extra)
