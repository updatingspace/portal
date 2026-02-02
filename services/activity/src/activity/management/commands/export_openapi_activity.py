from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from django.core.management.base import BaseCommand
from ninja import NinjaAPI


class Command(BaseCommand):
    help = "Export OpenAPI schema for Activity service (django-ninja)."
    requires_system_checks: list[str] = []

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            default="openapi.activity.json",
            help="Output file path (relative to current working directory).",
        )

    def handle(self, *args, **options):
        # Load activity.api in isolated module namespace so we get a fresh
        # Router object (django-ninja routers can't be attached to 2 APIs).
        api_path = Path(__file__).resolve().parents[2] / "api.py"
        spec = importlib.util.spec_from_file_location(
            "activity._api_export",
            api_path,
        )
        if not spec or not spec.loader:
            raise RuntimeError(
                f"Unable to load activity api module from {api_path}"
            )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        activity_router = getattr(mod, "router")

        api = NinjaAPI(title="Activity Service API", version="1.0.0")
        api.add_router("/api/activity", activity_router)
        schema = api.get_openapi_schema(path_prefix="")

        out_path = Path(options["output"]).expanduser()
        if not out_path.is_absolute():
            out_path = Path.cwd() / out_path
        out_path.write_text(
            json.dumps(schema, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        self.stdout.write(
            self.style.SUCCESS(f"OpenAPI exported to {out_path}")
        )
