"""Run Portal's existing outbox command on a private scheduled Cloud Function."""

from __future__ import annotations

import os
from io import StringIO

import django
from django.core.management import call_command
from django.db import connections


def handler(event: object, context: object) -> dict[str, object]:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings")
    django.setup()
    output = StringIO()
    try:
        # Only persisted, approved provisioning events are processed. Invocation
        # payloads cannot submit applications, approve them, or choose owners.
        call_command("process_outbox", limit=10, stdout=output)
    finally:
        connections.close_all()
    return {"statusCode": 200, "body": output.getvalue().strip()}
