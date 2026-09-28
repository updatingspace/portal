"""Compare the one-query authorization loader with the ORM on disposable YDB."""

from __future__ import annotations

import os
from urllib.parse import urlparse

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings")
django.setup()

from django.conf import settings
from django.db import connection, connections
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
    connections.close_all()
    print(
        f"YDB one-query authorization: {count} contracts matched ORM and expected behavior; each used one query"
    )


if __name__ == "__main__":
    main()
