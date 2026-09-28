from __future__ import annotations

from argparse import ArgumentParser
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from access_control.bootstrap import seed_access_defaults


class Command(BaseCommand):
    help = "Add the missing permission catalog and global member templates; preserve tenant grants."

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument(
            "--dry-run", action="store_true", help="Plan without writing any rows."
        )

    def handle(self, *args: Any, **options: Any) -> None:
        try:
            result = seed_access_defaults(dry_run=options["dry_run"])
        except ValueError as exc:
            raise CommandError(str(exc)) from exc
        action = "planned" if options["dry_run"] else "created"
        self.stdout.write(
            self.style.SUCCESS(
                f"Access defaults {action}: permissions={result.permissions}, "
                f"roles={result.roles}, role_permissions={result.role_permissions}"
            )
        )
