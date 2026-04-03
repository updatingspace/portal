from __future__ import annotations

import json
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from portal.audit import PortalAuditEvent


class Command(BaseCommand):
    help = "Purge portal audit events by retention policy"

    def add_arguments(self, parser):
        parser.add_argument(
            "--audit-days",
            type=int,
            default=int(getattr(settings, "PORTAL_RETENTION_AUDIT_DAYS", 365)),
            help="Retention window for portal audit events in days",
        )

    def handle(self, *args, **options):
        now = timezone.now()
        audit_cutoff = now - timedelta(days=int(options["audit_days"]))
        audit_deleted, _ = PortalAuditEvent.objects.filter(created_at__lt=audit_cutoff).delete()

        payload = {
            "service": "portal",
            "executed_at": now.isoformat(),
            "cutoffs": {
                "portal_audit_before": audit_cutoff.isoformat(),
            },
            "counts": {
                "portal_audit_deleted": audit_deleted,
            },
        }
        self.stdout.write(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False))
