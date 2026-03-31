from __future__ import annotations

import json
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from activity.audit import ActivityAuditEvent
from activity.models import Outbox, RawEvent


class Command(BaseCommand):
    help = "Purge activity raw events and processed outbox rows by retention policy"

    def add_arguments(self, parser):
        parser.add_argument(
            "--raw-events-days",
            type=int,
            default=int(getattr(settings, "ACTIVITY_RETENTION_RAW_DAYS", 30)),
            help="Retention window for raw events in days",
        )
        parser.add_argument(
            "--processed-outbox-days",
            type=int,
            default=int(getattr(settings, "ACTIVITY_RETENTION_PROCESSED_OUTBOX_DAYS", 14)),
            help="Retention window for processed outbox rows in days",
        )
        parser.add_argument(
            "--audit-days",
            type=int,
            default=int(getattr(settings, "ACTIVITY_RETENTION_AUDIT_DAYS", 365)),
            help="Retention window for activity audit events in days",
        )

    def handle(self, *args, **options):
        now = timezone.now()
        raw_cutoff = now - timedelta(days=int(options["raw_events_days"]))
        outbox_cutoff = now - timedelta(days=int(options["processed_outbox_days"]))
        audit_cutoff = now - timedelta(days=int(options["audit_days"]))

        raw_events_deleted, _ = RawEvent.objects.filter(fetched_at__lt=raw_cutoff).delete()
        outbox_deleted, _ = Outbox.objects.filter(
            processed_at__isnull=False,
            processed_at__lt=outbox_cutoff,
        ).delete()
        audit_deleted, _ = ActivityAuditEvent.objects.filter(created_at__lt=audit_cutoff).delete()

        payload = {
            "service": "activity",
            "executed_at": now.isoformat(),
            "cutoffs": {
                "raw_events_before": raw_cutoff.isoformat(),
                "processed_outbox_before": outbox_cutoff.isoformat(),
                "activity_audit_before": audit_cutoff.isoformat(),
            },
            "counts": {
                "raw_events_deleted": raw_events_deleted,
                "processed_outbox_deleted": outbox_deleted,
                "activity_audit_deleted": audit_deleted,
            },
        }
        self.stdout.write(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False))
