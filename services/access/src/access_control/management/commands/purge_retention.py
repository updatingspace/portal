from __future__ import annotations

import json
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from access_control.models import TenantAdminAuditEvent


class Command(BaseCommand):
    help = "Purge tenant admin audit events by retention policy"

    def add_arguments(self, parser):
        parser.add_argument(
            "--audit-days",
            type=int,
            default=int(getattr(settings, "ACCESS_RETENTION_AUDIT_DAYS", 365)),
            help="Retention window for tenant admin audit events in days",
        )

    def handle(self, *args, **options):
        now = timezone.now()
        audit_cutoff = now - timedelta(days=int(options["audit_days"]))
        audit_deleted, _ = TenantAdminAuditEvent.objects.filter(created_at__lt=audit_cutoff).delete()

        payload = {
            "service": "access",
            "executed_at": now.isoformat(),
            "cutoffs": {
                "tenant_admin_audit_before": audit_cutoff.isoformat(),
            },
            "counts": {
                "tenant_admin_audit_deleted": audit_deleted,
            },
        }
        self.stdout.write(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False))
