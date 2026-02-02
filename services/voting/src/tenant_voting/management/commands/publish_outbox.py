"""
Django management command to publish outbox messages.

Reads unpublished OutboxMessage records and sends them to the Activity service
via HTTP POST. Marks messages as published once successfully delivered.

Usage:
    # Run once
    python manage.py publish_outbox
    
    # Run continuously with polling interval
    python manage.py publish_outbox --daemon --interval=5
    
    # Process specific number of messages
    python manage.py publish_outbox --batch-size=100
    
    # Retry failed messages (older than 1 hour)
    python manage.py publish_outbox --retry-failed --retry-age=3600
"""

import logging
import signal
import time
from datetime import timedelta

import httpx
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from tenant_voting.models import OutboxMessage

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Publish outbox messages to Activity service"
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.running = True
        self.messages_published = 0
        self.messages_failed = 0
    
    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=50,
            help="Number of messages to process per batch (default: 50)",
        )
        parser.add_argument(
            "--daemon",
            action="store_true",
            help="Run continuously in daemon mode",
        )
        parser.add_argument(
            "--interval",
            type=int,
            default=5,
            help="Polling interval in seconds for daemon mode (default: 5)",
        )
        parser.add_argument(
            "--retry-failed",
            action="store_true",
            help="Retry previously failed messages",
        )
        parser.add_argument(
            "--retry-age",
            type=int,
            default=3600,
            help="Retry messages failed more than N seconds ago (default: 3600)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be published without actually sending",
        )
    
    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        daemon = options["daemon"]
        interval = options["interval"]
        retry_failed = options["retry_failed"]
        retry_age = options["retry_age"]
        dry_run = options["dry_run"]
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._handle_signal)
        signal.signal(signal.SIGTERM, self._handle_signal)
        
        activity_url = getattr(settings, "ACTIVITY_SERVICE_URL", "http://activity:8006/api/v1")
        events_endpoint = f"{activity_url}/events/ingest"
        
        hmac_secret = getattr(settings, "BFF_INTERNAL_HMAC_SECRET", "")
        
        self.stdout.write(
            self.style.SUCCESS(f"Starting outbox publisher (batch_size={batch_size})")
        )
        
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN MODE - no messages will be sent"))
        
        while self.running:
            try:
                count = self._process_batch(
                    batch_size=batch_size,
                    events_endpoint=events_endpoint,
                    hmac_secret=hmac_secret,
                    retry_failed=retry_failed,
                    retry_age=retry_age,
                    dry_run=dry_run,
                )
                
                if count == 0 and not daemon:
                    self.stdout.write("No pending messages found.")
                    break
                
                if not daemon:
                    break
                
                # Sleep before next poll
                time.sleep(interval)
                
            except Exception as e:
                logger.error(f"Error in outbox publisher: {e}", exc_info=True)
                if not daemon:
                    raise
                time.sleep(interval)
        
        self.stdout.write(
            self.style.SUCCESS(
                f"Outbox publisher stopped. Published: {self.messages_published}, Failed: {self.messages_failed}"
            )
        )
    
    def _process_batch(
        self,
        batch_size: int,
        events_endpoint: str,
        hmac_secret: str,
        retry_failed: bool,
        retry_age: int,
        dry_run: bool,
    ) -> int:
        """Process a batch of outbox messages. Returns count processed."""
        
        # Build query for unpublished messages
        queryset = OutboxMessage.objects.filter(published_at__isnull=True)
        
        if retry_failed:
            # Also include old published messages that might have failed downstream
            cutoff = timezone.now() - timedelta(seconds=retry_age)
            queryset = OutboxMessage.objects.filter(
                models.Q(published_at__isnull=True) |
                models.Q(published_at__lt=cutoff, occurred_at__gt=cutoff)
            )
        
        # Order by occurred_at to maintain event ordering
        messages = list(
            queryset.order_by("occurred_at")[:batch_size]
            .select_for_update(skip_locked=True)
        )
        
        if not messages:
            return 0
        
        self.stdout.write(f"Processing {len(messages)} messages...")
        
        with httpx.Client(timeout=10.0) as client:
            for msg in messages:
                try:
                    if dry_run:
                        self.stdout.write(
                            f"  [DRY RUN] Would publish {msg.event_type} ({msg.id})"
                        )
                        continue
                    
                    self._publish_message(
                        client=client,
                        message=msg,
                        events_endpoint=events_endpoint,
                        hmac_secret=hmac_secret,
                    )
                    self.messages_published += 1
                    
                except Exception as e:
                    self.messages_failed += 1
                    logger.error(
                        f"Failed to publish message {msg.id}: {e}",
                        extra={
                            "message_id": str(msg.id),
                            "event_type": msg.event_type,
                            "tenant_id": str(msg.tenant_id),
                        }
                    )
        
        return len(messages)
    
    def _publish_message(
        self,
        client: httpx.Client,
        message: OutboxMessage,
        events_endpoint: str,
        hmac_secret: str,
    ) -> None:
        """Publish a single outbox message to Activity service."""
        
        event_payload = {
            "event_id": str(message.id),
            "event_type": message.event_type,
            "tenant_id": str(message.tenant_id),
            "occurred_at": message.occurred_at.isoformat(),
            "payload": message.payload,
            "source": "voting",
        }
        
        headers = {
            "Content-Type": "application/json",
            "X-Source-Service": "voting",
        }
        
        # Add HMAC signature if configured
        if hmac_secret:
            import hashlib
            import hmac as hmac_lib
            import json
            
            body_json = json.dumps(event_payload, sort_keys=True)
            signature = hmac_lib.new(
                hmac_secret.encode(),
                body_json.encode(),
                hashlib.sha256
            ).hexdigest()
            headers["X-Updspace-Signature"] = signature
        
        response = client.post(
            events_endpoint,
            json=event_payload,
            headers=headers,
        )
        
        if response.status_code >= 400:
            raise Exception(
                f"Activity service returned {response.status_code}: {response.text}"
            )
        
        # Mark as published
        with transaction.atomic():
            message.published_at = timezone.now()
            message.save(update_fields=["published_at"])
        
        logger.info(
            f"Published event {message.event_type}",
            extra={
                "message_id": str(message.id),
                "event_type": message.event_type,
                "tenant_id": str(message.tenant_id),
            }
        )
    
    def _handle_signal(self, signum, frame):
        """Handle shutdown signals gracefully."""
        self.stdout.write(
            self.style.WARNING(f"\nReceived signal {signum}, shutting down...")
        )
        self.running = False
