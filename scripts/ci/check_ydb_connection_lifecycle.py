"""Check Django request cleanup against disposable YDB; no table writes."""

from __future__ import annotations

import os
import time
from unittest.mock import patch
from urllib.parse import urlparse

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings")
django.setup()

from django.conf import settings
from django.db import close_old_connections, connection, connections


def query() -> None:
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        assert cursor.fetchone()[0] == 1


def main() -> None:
    if (
        settings.DB_DRIVER != "ydb"
        or urlparse(os.environ.get("YDB_ENDPOINT", "")).hostname
        not in {"localhost", "127.0.0.1"}
        or os.environ.get("YDB_DATABASE") != "/local"
    ):
        raise SystemExit("Connection lifecycle checks require disposable local YDB")
    connections.close_all()
    assert connection.settings_dict["CONN_MAX_AGE"] == 600
    query()
    first = connection.connection
    close_old_connections()
    assert connection.connection is first
    query()
    assert connection.connection is first

    connection.close_at = time.monotonic() - 1
    close_old_connections()
    assert connection.connection is None
    query()
    assert connection.connection is not first

    connection.errors_occurred = True
    with patch.object(connection, "is_usable", return_value=False):
        close_old_connections()
    assert connection.connection is None
    query()

    connections.close_all()
    try:
        connection.settings_dict["CONN_MAX_AGE"] = 0
        query()
        close_old_connections()
        assert connection.connection is None
    finally:
        connection.settings_dict["CONN_MAX_AGE"] = 600
        connections.close_all()
    print("YDB request lifecycle: reuse, expiry, unusable replacement and zero lifetime passed; no table writes")


if __name__ == "__main__":
    main()
