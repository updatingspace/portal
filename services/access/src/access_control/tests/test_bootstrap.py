from __future__ import annotations

from io import StringIO
from unittest.mock import patch
from uuid import uuid4

from django.core.management import call_command
from django.test import TestCase

from access_control.bootstrap import SeedResult, seed_access_defaults
from access_control.models import Permission, Role, RoleBinding, RolePermission
from access_control.permissions_mvp import (
    DEFAULT_MEMBER_ROLE_PERMISSIONS,
    MVP_PERMISSIONS,
)
from access_control.services import MasterFlags, compute_effective_access


class AccessBootstrapTests(TestCase):
    def setUp(self):
        Role.objects.all().delete()
        Permission.objects.all().delete()

    def decision(self, tenant, key="portal.profile.read_self", **flags):
        return compute_effective_access(
            tenant_id=tenant,
            user_id=uuid4(),
            permission_key=key,
            scope_type="TENANT",
            scope_id=str(tenant),
            master_flags=MasterFlags(**flags),
        )

    def test_empty_database_receives_usable_member_baseline_without_admin_grants(self):
        result = seed_access_defaults()
        self.assertEqual(result.permissions, len(MVP_PERMISSIONS))
        self.assertEqual(result.roles, len(DEFAULT_MEMBER_ROLE_PERMISSIONS))
        for service, keys in DEFAULT_MEMBER_ROLE_PERMISSIONS.items():
            role = Role.objects.get(tenant_id=None, service=service, name="member")
            self.assertTrue(role.is_system_template)
            self.assertSetEqual(
                set(role.role_permissions.values_list("permission_id", flat=True)),
                set(keys),
            )
        self.assertTrue(self.decision(uuid4()).allowed)
        self.assertFalse(self.decision(uuid4(), "portal.roles.write").allowed)
        self.assertEqual(RoleBinding.objects.count(), 0)

    def test_repeat_is_a_noop_and_preserves_custom_catalog_and_template_grants(self):
        seed_access_defaults()
        Permission.objects.filter(key="portal.profile.read_self").update(
            description="Custom"
        )
        custom = Permission.objects.create(key="portal.custom.read", service="portal")
        role = Role.objects.get(tenant_id=None, service="portal", name="member")
        RolePermission.objects.create(role=role, permission=custom)
        before = list(Role.objects.order_by("id").values())
        self.assertEqual(seed_access_defaults(), SeedResult())
        self.assertEqual(list(Role.objects.order_by("id").values()), before)
        self.assertEqual(
            Permission.objects.get(pk="portal.profile.read_self").description, "Custom"
        )
        self.assertTrue(
            RolePermission.objects.filter(role=role, permission=custom).exists()
        )

    def test_tenant_member_override_survives_and_other_tenant_uses_baseline(self):
        tenant, other = uuid4(), uuid4()
        role = Role.objects.create(tenant_id=tenant, service="portal", name="member")
        binding = RoleBinding.objects.create(
            tenant_id=tenant,
            user_id=uuid4(),
            scope_type="TENANT",
            scope_id=str(tenant),
            role=role,
        )
        seed_access_defaults()
        self.assertFalse(self.decision(tenant).allowed)
        self.assertTrue(self.decision(other).allowed)
        self.assertEqual(RolePermission.objects.filter(role=role).count(), 0)
        self.assertEqual(RoleBinding.objects.get(pk=binding.pk).role_id, role.id)

    def test_master_denials_still_override_seeded_baseline(self):
        seed_access_defaults()
        for flags in [
            {"suspended": True},
            {"banned": True},
            {"suspended": True, "system_admin": True},
        ]:
            with self.subTest(flags=flags):
                self.assertFalse(self.decision(uuid4(), **flags).allowed)

    def test_dry_run_reports_missing_rows_without_writes(self):
        output = StringIO()
        call_command("seed_access_defaults", dry_run=True, stdout=output)
        self.assertIn(f"planned: permissions={len(MVP_PERMISSIONS)}", output.getvalue())
        self.assertEqual(Permission.objects.count(), 0)
        self.assertEqual(Role.objects.count(), 0)
        self.assertEqual(RolePermission.objects.count(), 0)

    def test_interrupted_seed_rolls_back_all_baseline_writes(self):
        with (
            patch.object(
                RolePermission.objects,
                "get_or_create",
                side_effect=RuntimeError("interrupted"),
            ),
            self.assertRaisesRegex(RuntimeError, "interrupted"),
        ):
            seed_access_defaults()
        self.assertEqual(Permission.objects.count(), 0)
        self.assertEqual(Role.objects.count(), 0)
        self.assertEqual(RolePermission.objects.count(), 0)

    def test_non_system_global_role_conflict_fails_without_claiming_or_granting(self):
        role = Role.objects.create(tenant_id=None, service="portal", name="member")
        with self.assertRaisesRegex(ValueError, "not a system template"):
            seed_access_defaults()
        role.refresh_from_db()
        self.assertFalse(role.is_system_template)
        self.assertEqual(Permission.objects.count(), 0)
        self.assertEqual(RolePermission.objects.count(), 0)

    def test_wrong_service_catalog_entry_fails_without_overwriting_it(self):
        Permission.objects.create(key="portal.profile.read_self", service="voting")
        with self.assertRaisesRegex(ValueError, "unexpected service"):
            seed_access_defaults()
        self.assertEqual(
            Permission.objects.get(pk="portal.profile.read_self").service, "voting"
        )
        self.assertEqual(Permission.objects.count(), 1)
        self.assertEqual(Role.objects.count(), 0)
