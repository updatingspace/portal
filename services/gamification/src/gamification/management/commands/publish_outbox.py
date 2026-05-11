from __future__ import annotations

import uuid
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from gamification.models import OutboxMessage


class Command(BaseCommand):
    help = "Marks unpublished gamification outbox rows as published."

    def add_arguments(self, parser):
        parser.add_argument("--batch-size", type=int, default=100)
        parser.add_argument("--lease-seconds", type=int, default=300)

    def handle(self, *args, **options):
        now = timezone.now()
        lease_cutoff = now - timedelta(seconds=options["lease_seconds"])
        claimable_filter = Q(claimed_at__isnull=True) | Q(claimed_at__lt=lease_cutoff)
        candidate_ids = list(
            OutboxMessage.objects.filter(published_at__isnull=True)
            .filter(claimable_filter)
            .order_by("occurred_at")
            .values_list("id", flat=True)[: options["batch_size"]]
        )
        if not candidate_ids:
            self.stdout.write(self.style.SUCCESS("Published 0 gamification outbox rows"))
            return
        claim_token = uuid.uuid4()
        OutboxMessage.objects.filter(
            id__in=candidate_ids,
            published_at__isnull=True,
        ).filter(claimable_filter).update(
            claimed_at=now,
            claim_token=claim_token,
        )
        updated = OutboxMessage.objects.filter(claim_token=claim_token).update(
            published_at=now,
            claimed_at=None,
            claim_token=None,
        )
        self.stdout.write(
            self.style.SUCCESS(f"Published {updated} gamification outbox rows")
        )
