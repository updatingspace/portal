from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from featureflags.models import OutboxMessage


class Command(BaseCommand):
    help = "Deletes published outbox rows older than retention window."

    def handle(self, *args, **options):
        retention_days = int(getattr(settings, "FEATURE_FLAGS_RETENTION_PUBLISHED_OUTBOX_DAYS", 30))
        cutoff = timezone.now() - timedelta(days=retention_days)
        deleted, _ = OutboxMessage.objects.filter(published_at__isnull=False, published_at__lt=cutoff).delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} outbox records"))
