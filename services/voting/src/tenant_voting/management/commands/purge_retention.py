from __future__ import annotations

import json
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from tenant_voting.models import OutboxMessage


class Command(BaseCommand):
    help = "Purge published voting outbox rows by retention policy"

    def add_arguments(self, parser):
        parser.add_argument(
            "--published-outbox-days",
            type=int,
            default=int(getattr(settings, "VOTING_RETENTION_PUBLISHED_OUTBOX_DAYS", 30)),
            help="Retention window for published outbox rows in days",
        )

    def handle(self, *args, **options):
        now = timezone.now()
        outbox_cutoff = now - timedelta(days=int(options["published_outbox_days"]))
        outbox_deleted, _ = OutboxMessage.objects.filter(
            published_at__isnull=False,
            published_at__lt=outbox_cutoff,
        ).delete()

        payload = {
            "service": "voting",
            "executed_at": now.isoformat(),
            "cutoffs": {
                "published_outbox_before": outbox_cutoff.isoformat(),
            },
            "counts": {
                "published_outbox_deleted": outbox_deleted,
            },
        }
        self.stdout.write(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False))
