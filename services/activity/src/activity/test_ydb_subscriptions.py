import json
from uuid import uuid4

import ydb
from app.ydb_compat import patch_ydb_orm
from django.db.models.sql import InsertQuery
from ydb_backend.backend.base import DatabaseWrapper

from activity.models import Subscription


def test_subscription_insert_serializes_rules_and_preserves_tenant_types():
    patch_ydb_orm()
    connection = DatabaseWrapper({"NAME": "default", "OPTIONS": {}})
    rules = {"scopes": [{"scope_type": "TENANT", "scope_id": str(uuid4())}]}
    subscription = Subscription(tenant_id=uuid4(), user_id=uuid4(), rules_json=rules)
    fields = [field for field in Subscription._meta.local_concrete_fields if not field.primary_key]
    query = InsertQuery(Subscription)
    query.insert_values(fields, [subscription])
    _, params = query.get_compiler(connection=connection).as_sql()[0]
    rows, _ = params["$in_"]
    assert json.loads(rows[0]["rules_json"]) == rules
    assert rows[0]["tenant_id"] == subscription.tenant_id
    assert rows[0]["user_id"] == subscription.user_id


def test_subscription_exists_keeps_literal_separate_from_tenant_uuid():
    patch_ydb_orm()
    tenant_id = uuid4()
    query = Subscription.objects.filter(tenant_id=tenant_id).query.exists()
    connection = DatabaseWrapper({"NAME": "default", "OPTIONS": {}})
    _, params = query.get_compiler(connection=connection).as_sql()
    assert params["$element_1"] == 1
    assert params["$element_2"] == (tenant_id, ydb.PrimitiveType.UUID)


def test_live_outbox_cursor_orders_by_column_not_constant():
    from activity.models import Outbox

    patch_ydb_orm()
    connection = DatabaseWrapper({"NAME": "default", "OPTIONS": {}})
    query = (
        Outbox.objects.filter(tenant_id=uuid4(), aggregate_type="news")
        .order_by("-id")
        .values_list("id", flat=True)[:1]
        .query
    )
    sql, _ = query.get_compiler(connection=connection).as_sql()
    assert "ORDER BY `id` DESC" in sql
    assert "ORDER BY 1" not in sql
