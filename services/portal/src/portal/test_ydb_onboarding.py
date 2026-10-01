from uuid import uuid4

import ydb
from django.db.models.sql import UpdateQuery

from app.ydb_compat import patch_ydb_orm
from portal.models import TenantApplication, TenantMembership, TenantSlugClaim


def compiler(query):
    from ydb_backend.backend.base import DatabaseWrapper

    patch_ydb_orm()
    return query.get_compiler(
        connection=DatabaseWrapper({"NAME": "default", "OPTIONS": {}})
    )


def test_claim_exists_does_not_shift_literal_and_slug():
    sql, params = compiler(
        TenantSlugClaim.objects.filter(slug="new-team").query.exists()
    ).as_sql()
    assert "SELECT $element_1" in sql
    assert params["$element_1"] == 1
    assert params["$element_2"] == ("new-team", ydb.PrimitiveType.Utf8)


def test_membership_uuid_filter_uses_uuid_type():
    tenant_id = uuid4()
    _, params = compiler(
        TenantMembership.objects.filter(tenant_id=tenant_id).query.exists()
    ).as_sql()
    assert params["$element_1"] == 1
    assert params["$element_2"] == (tenant_id, ydb.PrimitiveType.UUID)


def test_approval_compare_and_set_preserves_parameters():
    application_id = uuid4()
    query = TenantApplication.objects.filter(
        id=application_id, status="pending"
    ).query.chain(UpdateQuery)
    query.add_update_values({"status": "provisioning"})
    sql, params = compiler(query).as_sql()
    assert "UPDATE" in sql
    assert len(params) == 3
    assert (application_id, ydb.PrimitiveType.UUID) in params.values()
    assert ("pending", ydb.PrimitiveType.Utf8) in params.values()
    assert ("provisioning", ydb.PrimitiveType.Utf8) in params.values()


def test_leave_compare_and_set_is_tenant_and_user_scoped():
    tenant_id, user_id, membership_id = uuid4(), uuid4(), uuid4()
    query = TenantMembership.objects.filter(
        id=membership_id, tenant_id=tenant_id, user_id=user_id,
        status="active", base_role="member",
    ).query.chain(UpdateQuery)
    query.add_update_values({"status": "left"})
    sql, params = compiler(query).as_sql()
    assert "UPDATE" in sql
    for value in [tenant_id, user_id, membership_id]:
        assert (value, ydb.PrimitiveType.UUID) in params.values()
    for value in ["active", "member", "left"]:
        assert (value, ydb.PrimitiveType.Utf8) in params.values()
