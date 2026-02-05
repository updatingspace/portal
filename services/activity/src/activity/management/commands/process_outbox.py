"""
Django management command to process outbox events.

Processes pending events from the Outbox table and publishes them
to downstream services. Can run as a daemon or process a batch.
"""

from __future__ import annotations

import logging
import signal
import time

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from activity.models import Outbox, OutboxEventType

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Process pending outbox events and publish to downstream services"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._shutdown_requested = False

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=100,
            help="Number of events to process per batch (default: 100)",
        )
        parser.add_argument(
            "--daemon",
            action="store_true",
            help="Run continuously as a daemon",
        )
        parser.add_argument(
            "--poll-interval",
            type=float,
            default=5.0,
            help="Seconds between polling when in daemon mode (default: 5)",
        )
        parser.add_argument(
            "--max-retries",
            type=int,
            default=3,
            help="Maximum retries for failed events (default: 3)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Process events without actually publishing",
        )

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        daemon = options["daemon"]
        poll_interval = options["poll_interval"]
        max_retries = options["max_retries"]
        dry_run = options["dry_run"]

        if daemon:
            signal.signal(signal.SIGTERM, self._handle_signal)
            signal.signal(signal.SIGINT, self._handle_signal)

        self.stdout.write(
            self.style.SUCCESS(
                f"Starting outbox processor (batch={batch_size}, daemon={daemon})"
            )
        )

        total_processed = 0
        while not self._shutdown_requested:
            processed = self._process_batch(
                batch_size=batch_size,
                max_retries=max_retries,
                dry_run=dry_run,
            )
            total_processed += processed

            if processed > 0:
                self.stdout.write(f"Processed {processed} events")

            if not daemon:
                break

            if processed == 0:
                # No events to process, wait before polling again
                time.sleep(poll_interval)

        self.stdout.write(
            self.style.SUCCESS(f"Outbox processor stopped. Total processed: {total_processed}")
        )

    def _handle_signal(self, signum, frame):
        self.stdout.write(self.style.WARNING(f"Received signal {signum}, shutting down..."))
        self._shutdown_requested = True

    def _process_batch(
        self,
        *,
        batch_size: int,
        max_retries: int,
        dry_run: bool,
    ) -> int:
        """Process a batch of pending outbox events."""
        events = list(
            Outbox.objects.filter(
                processed_at__isnull=True,
                retry_count__lt=max_retries,
            )
            .order_by("created_at")[:batch_size]
            .select_for_update(skip_locked=True)
        )

        processed = 0
        for event in events:
            if self._shutdown_requested:
                break

            try:
                with transaction.atomic():
                    success = self._publish_event(event, dry_run=dry_run)

                    if success:
                        event.processed_at = timezone.now()
                        event.save(update_fields=["processed_at"])
                        processed += 1
                    else:
                        event.retry_count += 1
                        event.save(update_fields=["retry_count"])

            except Exception as exc:
                logger.error(
                    "Failed to process outbox event",
                    extra={
                        "event_id": event.id,
                        "event_type": event.event_type,
                        "error": str(exc),
                    },
                    exc_info=True,
                )
                with transaction.atomic():
                    event.retry_count += 1
                    event.error_message = str(exc)[:1000]
                    event.save(update_fields=["retry_count", "error_message"])

        return processed

    def _publish_event(self, event: Outbox, *, dry_run: bool) -> bool:
        """
        Publish a single outbox event to downstream services.

        Returns True if publishing succeeded, False otherwise.
        """
        if dry_run:
            logger.info(
                "DRY RUN: Would publish event",
                extra={
                    "event_id": event.id,
                    "event_type": event.event_type,
                    "payload": event.payload_json,
                },
            )
            return True

        # Route to appropriate handler based on event type
        handlers = {
            OutboxEventType.FEED_UPDATED: self._handle_feed_updated,
            OutboxEventType.SYNC_COMPLETED: self._handle_sync_completed,
            OutboxEventType.SYNC_FAILED: self._handle_sync_failed,
            OutboxEventType.ACCOUNT_LINKED: self._handle_account_linked,
            OutboxEventType.ACCOUNT_UNLINKED: self._handle_account_unlinked,
        }

        handler = handlers.get(event.event_type)
        if handler:
            return handler(event)

        # Unknown event type, mark as processed to avoid blocking
        logger.warning(
            "Unknown outbox event type",
            extra={"event_id": event.id, "event_type": event.event_type},
        )
        return True

    def _handle_feed_updated(self, event: Outbox) -> bool:
        """
        Handle feed.updated events.

        Could notify real-time services, update caches, etc.
        """
        logger.info(
            "Feed updated event processed",
            extra={
                "tenant_id": str(event.tenant_id),
                "event_id": event.id,
                "payload": event.payload_json,
            },
        )

        # TODO: Integrate with real-time notification service
        # For now, just log and mark as processed
        return True

    def _handle_sync_completed(self, event: Outbox) -> bool:
        """Handle sync.completed events."""
        logger.info(
            "Sync completed event processed",
            extra={
                "tenant_id": str(event.tenant_id),
                "event_id": event.id,
                "payload": event.payload_json,
            },
        )
        return True

    def _handle_sync_failed(self, event: Outbox) -> bool:
        """Handle sync.failed events."""
        logger.warning(
            "Sync failed event processed",
            extra={
                "tenant_id": str(event.tenant_id),
                "event_id": event.id,
                "payload": event.payload_json,
            },
        )

        # TODO: Could notify administrators about sync failures
        return True

    def _handle_account_linked(self, event: Outbox) -> bool:
        """Handle account.linked events."""
        logger.info(
            "Account linked event processed",
            extra={
                "tenant_id": str(event.tenant_id),
                "event_id": event.id,
                "payload": event.payload_json,
            },
        )
        return True

    def _handle_account_unlinked(self, event: Outbox) -> bool:
        """Handle account.unlinked events."""
        logger.info(
            "Account unlinked event processed",
            extra={
                "tenant_id": str(event.tenant_id),
                "event_id": event.id,
                "payload": event.payload_json,
            },
        )
        return True
