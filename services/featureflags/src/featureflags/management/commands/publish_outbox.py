from __future__ import annotations

from django.core.management.base import BaseCommand
from django.utils import timezone

from featureflags.models import OutboxMessage


class Command(BaseCommand):
    help = "Marks unpublished feature-flag outbox events as published (MVP stub publisher)."

    def handle(self, *args, **options):
        now = timezone.now()
        updated = OutboxMessage.objects.filter(published_at__isnull=True).update(published_at=now)
        self.stdout.write(self.style.SUCCESS(f"Published {updated} outbox events"))
