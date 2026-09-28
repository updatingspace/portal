"""Compare the one-query authorization loader with the ORM on disposable YDB."""

from __future__ import annotations

import os
import time
from unittest.mock import patch
from urllib.parse import urlparse
from uuid import uuid4

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings")
django.setup()

from django.conf import settings
from django.db import close_old_connections, connection, connections
from django.test import override_settings

from access_control.services import CheckDecision, compute_effective_access
from access_control.tests.decision_contracts import exercise_decision_contracts


def _result(decision: CheckDecision) -> tuple:
    return (
        decision.allowed,
        decision.reason_code,
        # Bindings have no ORDER BY; compare the complete role values by identity.
        sorted(
            tuple(getattr(role, field.attname) for field in role._meta.concrete_fields)
            for role in decision.roles
        ),
        decision.permissions,
    )


def check_connection_lifecycle() -> None:
    tenant, user = uuid4(), uuid4()

    def decide() -> None:
        result = compute_effective_access(
            tenant_id=tenant,
            user_id=user,
            permission_key="portal.profile.read_self",
            scope_type="TENANT",
            scope_id=str(tenant),
        )
        assert result.allowed and result.reason_code == "RBAC_ALLOW"

    connections.close_all()
    assert connection.settings_dict["CONN_MAX_AGE"] == 600
    decide()
    first = connection.connection
    # Django invokes this at request start/end. TestClient disconnects the
    # signal receiver, so exercise the real cleanup hook explicitly here.
    close_old_connections()
    assert connection.connection is first
    decide()
    assert connection.connection is first

    connection.close_at = time.monotonic() - 1
    close_old_connections()
    assert connection.connection is None
    decide()
    assert connection.connection is not first

    # Unusable connections are discarded before handling the next request.
    connection.errors_occurred = True
    with patch.object(connection, "is_usable", return_value=False):
        close_old_connections()
    assert connection.connection is None
    decide()

    # A zero lifetime still opts out of reuse when explicitly configured.
    connections.close_all()
    try:
        connection.settings_dict["CONN_MAX_AGE"] = 0
        decide()
        close_old_connections()
        assert connection.connection is None
    finally:
        connection.settings_dict["CONN_MAX_AGE"] = 600
        connections.close_all()


def main() -> None:
    if (
        settings.DB_DRIVER != "ydb"
        or urlparse(os.environ.get("YDB_ENDPOINT", "")).hostname
        not in {"localhost", "127.0.0.1"}
        or os.environ.get("YDB_DATABASE") != "/local"
    ):
        raise SystemExit(
            "Query contracts require a disposable local /local YDB database"
        )

    def compare(**kwargs):
        queries = []

        def capture(execute, sql, params, many, context):
            queries.append(sql)
            return execute(sql, params, many, context)

        with override_settings(ACCESS_YDB_BATCH_CHECKS=False):
            expected = compute_effective_access(**kwargs)
        with (
            override_settings(ACCESS_YDB_BATCH_CHECKS=True),
            connection.execute_wrapper(capture),
        ):
            actual = compute_effective_access(**kwargs)
        assert len(queries) == 1, f"Decision issued {len(queries)} queries"
        assert _result(actual) == _result(expected), (
            kwargs,
            _result(expected),
            _result(actual),
        )
        return actual

    count = exercise_decision_contracts(compare)
    check_connection_lifecycle()
    connections.close_all()
    print(
        f"YDB one-query authorization: {count} contracts matched ORM and expected behavior; each used one query"
    )
    print(
        "YDB request lifecycle: reuse, expiry, unusable replacement and zero lifetime passed"
    )


if __name__ == "__main__":
    main()
