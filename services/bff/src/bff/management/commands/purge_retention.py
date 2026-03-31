from __future__ import annotations

import json

from django.conf import settings
from django.core.management.base import BaseCommand

from bff.dsar import purge_retention


class Command(BaseCommand):
    help = "Purge expired or revoked BFF sessions by retention policy"

    def add_arguments(self, parser):
        parser.add_argument(
            "--session-days",
            type=int,
            default=int(getattr(settings, "BFF_RETENTION_SESSION_DAYS", 30)),
            help="Retention window for expired or revoked sessions in days",
        )
        parser.add_argument(
            "--audit-days",
            type=int,
            default=int(getattr(settings, "BFF_RETENTION_AUDIT_DAYS", 365)),
            help="Retention window for BFF audit events in days",
        )

    def handle(self, *args, **options):
        payload = purge_retention(
            session_days=int(options["session_days"]),
            audit_days=int(options["audit_days"]),
        )
        self.stdout.write(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False))
