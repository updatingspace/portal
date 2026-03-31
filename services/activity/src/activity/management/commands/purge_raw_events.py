from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from activity.models import RawEvent


class Command(BaseCommand):
    help = "Delete raw Activity events outside the configured retention window."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=None,
            help="Override ACTIVITY_RAW_EVENT_RETENTION_DAYS for this run.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report how many rows would be deleted without changing data.",
        )

    def handle(self, *args, **options):
        days = options.get("days")
        if days is None:
            days = int(getattr(settings, "ACTIVITY_RAW_EVENT_RETENTION_DAYS", 7))
        if days < 0:
            raise CommandError("Retention days must be zero or greater")

        cutoff = timezone.now() - timedelta(days=days)
        queryset = RawEvent.objects.filter(fetched_at__lt=cutoff)
        count = queryset.count()

        if options.get("dry_run"):
            self.stdout.write(
                self.style.WARNING(
                    f"Would delete {count} raw events fetched before {cutoff.isoformat()}",
                )
            )
            return

        deleted, _ = queryset.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {deleted} raw events fetched before {cutoff.isoformat()}",
            )
        )