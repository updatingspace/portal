from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from typing import Any

import boto3
from botocore.config import Config
from django.db import transaction

logger = logging.getLogger(__name__)

YMQ_ENDPOINT_URL = "https://message-queue.api.cloud.yandex.net"
DEFAULT_REGION = "ru-central1"


@lru_cache(maxsize=16)
def _build_client(access_key: str, secret_key: str, region: str):
    return boto3.client(
        "sqs",
        endpoint_url=YMQ_ENDPOINT_URL,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(retries={"max_attempts": 2, "mode": "standard"}),
    )


@lru_cache(maxsize=32)
def _resolve_queue_url(queue_ref: str, access_key: str, secret_key: str, region: str) -> str:
    if queue_ref.startswith("http://") or queue_ref.startswith("https://"):
        return queue_ref
    client = _build_client(access_key, secret_key, region)
    return client.get_queue_url(QueueName=queue_ref)["QueueUrl"]


def schedule_outbox_wakeup(
    *,
    service_name: str,
    event_type: str,
    tenant_id: str,
    payload: dict[str, Any],
    queue_env: str = "YMQ_OUTBOX_QUEUE",
) -> None:
    queue_ref = os.getenv(queue_env, "").strip()
    access_key = os.getenv("S3_ACCESS_KEY_ID", "").strip()
    secret_key = os.getenv("S3_SECRET_ACCESS_KEY", "").strip()
    region = os.getenv("S3_REGION", DEFAULT_REGION).strip() or DEFAULT_REGION
    if not queue_ref or not access_key or not secret_key:
        logger.debug(
            "Skipping YMQ wake-up for %s: queue or credentials are missing",
            service_name,
        )
        return

    message_body = json.dumps(
        {
            "service": service_name,
            "event_type": event_type,
            "tenant_id": tenant_id,
            "payload": payload,
        },
        default=str,
        separators=(",", ":"),
    )

    def _publish() -> None:
        try:
            client = _build_client(access_key, secret_key, region)
            queue_url = _resolve_queue_url(queue_ref, access_key, secret_key, region)
            client.send_message(QueueUrl=queue_url, MessageBody=message_body)
        except Exception:
            logger.warning(
                "Failed to publish YMQ wake-up",
                extra={
                    "service": service_name,
                    "event_type": event_type,
                    "tenant_id": tenant_id,
                },
                exc_info=True,
            )

    transaction.on_commit(_publish)
