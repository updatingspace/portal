from __future__ import annotations

import uuid

from django.test import TestCase

from access_control.models import (
    Permission,
    PolicyAction,
    PolicyOverride,
    Role,
    RoleBinding,
    RolePermission,
    ScopeType,
)
from access_control.services import MasterFlags, compute_effective_access


class AccessControlComputeTests(TestCase):
    def setUp(self):
        self.tenant_id = uuid.uuid4()
        self.user_id = uuid.uuid4()
        self.team_id = "team-123"

        Permission.objects.get_or_create(
            key="voting.vote.cast",
            defaults={"description": "Cast a vote", "service": "voting"},
        )

        self.role = Role.objects.create(
            tenant_id=self.tenant_id,
            service="voting",
            name="voter",
            is_system_template=False,
        )
        RolePermission.objects.create(role=self.role, permission_id="voting.vote.cast")

    def test_master_suspended_denies_all(self):
        RoleBinding.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            scope_type=ScopeType.TENANT,
            scope_id=str(self.tenant_id),
            role=self.role,
        )
        decision = compute_effective_access(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            permission_key="voting.vote.cast",
            scope_type="TENANT",
            scope_id=str(self.tenant_id),
            master_flags=MasterFlags(suspended=True),
            return_effective_permissions=True,
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason_code, "MASTER_SUSPENDED")

    def test_master_system_admin_allows(self):
        decision = compute_effective_access(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            permission_key="voting.vote.cast",
            scope_type="TEAM",
            scope_id=self.team_id,
            master_flags=MasterFlags(system_admin=True),
        )
        self.assertTrue(decision.allowed)
        self.assertEqual(decision.reason_code, "MASTER_SYSTEM_ADMIN")

    def test_policy_deny_overrides_rbac(self):
        RoleBinding.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            scope_type=ScopeType.TENANT,
            scope_id=str(self.tenant_id),
            role=self.role,
        )
        PolicyOverride.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            action=PolicyAction.DENY,
            permission_id="voting.vote.cast",
            reason="blocked",
        )

        decision = compute_effective_access(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            permission_key="voting.vote.cast",
            scope_type="TENANT",
            scope_id=str(self.tenant_id),
            master_flags=MasterFlags(),
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason_code, "POLICY_DENY")

    def test_policy_allow_grants_without_roles(self):
        PolicyOverride.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            action=PolicyAction.ALLOW,
            permission_id="voting.vote.cast",
            reason="temporary",
        )

        decision = compute_effective_access(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            permission_key="voting.vote.cast",
            scope_type="TEAM",
            scope_id=self.team_id,
            master_flags=MasterFlags(),
        )
        self.assertTrue(decision.allowed)
        self.assertEqual(decision.reason_code, "POLICY_ALLOW")

    def test_tenant_scope_role_applies_to_team_scope(self):
        RoleBinding.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            scope_type=ScopeType.TENANT,
            scope_id=str(self.tenant_id),
            role=self.role,
        )

        decision = compute_effective_access(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            permission_key="voting.vote.cast",
            scope_type="TEAM",
            scope_id=self.team_id,
            master_flags=MasterFlags(),
        )
        self.assertTrue(decision.allowed)
        self.assertEqual(decision.reason_code, "RBAC_ALLOW")

    def test_unknown_permission_denies(self):
        decision = compute_effective_access(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            permission_key="voting.unknown",
            scope_type="TENANT",
            scope_id=str(self.tenant_id),
            master_flags=MasterFlags(),
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason_code, "UNKNOWN_PERMISSION")
