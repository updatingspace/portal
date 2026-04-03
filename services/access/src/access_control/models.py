from __future__ import annotations

import uuid

from django.db import models
from django.db.models import Q
from django.utils import timezone


class PermissionService(models.TextChoices):
    PORTAL = "portal", "portal"
    VOTING = "voting", "voting"
    EVENTS = "events", "events"
    ACTIVITY = "activity", "activity"
    GAMIFICATION = "gamification", "gamification"


class Permission(models.Model):
    """Permission catalog entry.

    Key is global and stable, e.g. "voting.vote.cast".
    """

    key = models.CharField(max_length=128, primary_key=True)
    description = models.CharField(max_length=255, blank=True, default="")
    service = models.CharField(max_length=32, choices=PermissionService.choices)

    class Meta:
        verbose_name = "Permission"
        verbose_name_plural = "Permissions"
        indexes = [models.Index(fields=["service"]) ]

    def __str__(self) -> str:  # pragma: no cover
        return self.key


class Role(models.Model):
    """Role within a tenant and a service.

    tenant_id is nullable for system templates.
    """

    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    service = models.CharField(max_length=32, choices=PermissionService.choices)
    name = models.CharField(max_length=128)
    is_system_template = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Role"
        verbose_name_plural = "Roles"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant_id", "service", "name"],
                name="ac_role_unique_per_tenant_service_name",
            ),
            models.UniqueConstraint(
                fields=["service", "name"],
                condition=Q(tenant_id__isnull=True),
                name="ac_role_unique_global_template",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant_id", "service"]),
            models.Index(fields=["service"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        scope = str(self.tenant_id) if self.tenant_id else "global"
        return f"{scope}:{self.service}:{self.name}"


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        to_field="key",
        db_column="permission_key",
        related_name="role_permissions",
    )

    class Meta:
        verbose_name = "Role permission"
        verbose_name_plural = "Role permissions"
        constraints = [
            models.UniqueConstraint(
                fields=["role", "permission"],
                name="ac_role_permission_unique",
            )
        ]
        indexes = [
            models.Index(fields=["role"]),
            models.Index(fields=["permission"]),
        ]


class ScopeType(models.TextChoices):
    GLOBAL = "GLOBAL", "GLOBAL"
    TENANT = "TENANT", "TENANT"
    COMMUNITY = "COMMUNITY", "COMMUNITY"
    TEAM = "TEAM", "TEAM"
    SERVICE = "SERVICE", "SERVICE"


class RoleBinding(models.Model):
    tenant_id = models.UUIDField(db_index=True)
    user_id = models.UUIDField(db_index=True)

    scope_type = models.CharField(max_length=16, choices=ScopeType.choices, db_index=True)
    scope_id = models.CharField(max_length=128, db_index=True)

    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="bindings")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Role binding"
        verbose_name_plural = "Role bindings"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant_id", "user_id", "scope_type", "scope_id", "role"],
                name="ac_role_binding_unique",
            )
        ]
        indexes = [
            models.Index(fields=["tenant_id", "user_id"]),
            models.Index(fields=["tenant_id", "user_id", "scope_type", "scope_id"]),
        ]


class PolicyAction(models.TextChoices):
    DENY = "deny", "deny"
    ALLOW = "allow", "allow"


class PolicyOverride(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    tenant_id = models.UUIDField(db_index=True)
    user_id = models.UUIDField(db_index=True)

    action = models.CharField(max_length=8, choices=PolicyAction.choices)
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        to_field="key",
        db_column="permission_key",
        null=True,
        blank=True,
        related_name="policy_overrides",
    )

    reason = models.CharField(max_length=255, blank=True, default="")
    expires_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Policy override"
        verbose_name_plural = "Policy overrides"
        indexes = [
            models.Index(fields=["tenant_id", "user_id"]),
            models.Index(fields=["tenant_id", "user_id", "action"]),
            models.Index(fields=["tenant_id", "user_id", "action", "permission"]),
            models.Index(fields=["expires_at"]),
        ]

    def is_active(self, now=None) -> bool:
        now = now or timezone.now()
        if self.expires_at is None:
            return True
        return now < self.expires_at


class TenantAdminAuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_index=True)
    performed_by = models.UUIDField(db_index=True)
    action = models.CharField(max_length=64)
    target_type = models.CharField(max_length=32, blank=True)
    target_id = models.CharField(max_length=128, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Tenant admin audit event"
        verbose_name_plural = "Tenant admin audit events"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant_id", "action"]),
            models.Index(fields=["tenant_id", "created_at"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.action} by {self.performed_by} ({self.tenant_id})"


# ---------------------------------------------------------------------------
# Rollout / Feature Flag / AB Experiment models
# ---------------------------------------------------------------------------


class RolloutTargetType(models.TextChoices):
    """What a feature flag or experiment targets."""
    ALL = "all", "All users"
    PERCENT = "percent", "Percentage rollout"
    USER_LIST = "user_list", "Explicit user list"
    TENANT_LIST = "tenant_list", "Explicit tenant list"


class FeatureFlag(models.Model):
    """Boolean feature flag — on/off per targeting rule.

    Flags can be global (tenant_id=None) or scoped to a single tenant.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.CharField(max_length=128, db_index=True)
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    description = models.CharField(max_length=255, blank=True, default="")

    enabled = models.BooleanField(default=False)
    target_type = models.CharField(
        max_length=16,
        choices=RolloutTargetType.choices,
        default=RolloutTargetType.ALL,
    )
    target_value = models.JSONField(
        default=dict,
        blank=True,
        help_text='Depends on target_type: percent={\"pct\": 25}, user_list={\"user_ids\": [...]}, etc.',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.UUIDField(null=True, blank=True)

    class Meta:
        verbose_name = "Feature flag"
        verbose_name_plural = "Feature flags"
        constraints = [
            models.UniqueConstraint(
                fields=["key", "tenant_id"],
                name="ac_feature_flag_unique_key_tenant",
            ),
            models.UniqueConstraint(
                fields=["key"],
                condition=Q(tenant_id__isnull=True),
                name="ac_feature_flag_unique_key_global",
            ),
        ]
        indexes = [
            models.Index(fields=["key"]),
            models.Index(fields=["tenant_id"]),
            models.Index(fields=["enabled"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        scope = str(self.tenant_id) if self.tenant_id else "global"
        return f"flag:{self.key} [{scope}] {'ON' if self.enabled else 'OFF'}"


class Experiment(models.Model):
    """A/B experiment with variant assignment.

    Each experiment has a key, list of variant names, and percentage weights.
    Assignment is deterministic via hash(user_key + experiment_key).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.CharField(max_length=128, db_index=True)
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    description = models.CharField(max_length=255, blank=True, default="")

    enabled = models.BooleanField(default=False)
    variants = models.JSONField(
        default=list,
        help_text='List of variant definitions: [{\"name\": \"control\", \"weight\": 50}, {\"name\": \"treatment\", \"weight\": 50}]',
    )
    target_type = models.CharField(
        max_length=16,
        choices=RolloutTargetType.choices,
        default=RolloutTargetType.ALL,
    )
    target_value = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.UUIDField(null=True, blank=True)

    class Meta:
        verbose_name = "Experiment"
        verbose_name_plural = "Experiments"
        constraints = [
            models.UniqueConstraint(
                fields=["key", "tenant_id"],
                name="ac_experiment_unique_key_tenant",
            ),
            models.UniqueConstraint(
                fields=["key"],
                condition=Q(tenant_id__isnull=True),
                name="ac_experiment_unique_key_global",
            ),
        ]
        indexes = [
            models.Index(fields=["key"]),
            models.Index(fields=["tenant_id"]),
            models.Index(fields=["enabled"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        scope = str(self.tenant_id) if self.tenant_id else "global"
        return f"experiment:{self.key} [{scope}] {'ON' if self.enabled else 'OFF'}"


class KillSwitch(models.Model):
    """Emergency kill switch for instant feature disable.

    When active=True, the affected feature_key is force-disabled regardless
    of FeatureFlag or Experiment state.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    feature_key = models.CharField(max_length=128, db_index=True)
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)

    active = models.BooleanField(default=True)
    reason = models.CharField(max_length=255, blank=True, default="")

    activated_at = models.DateTimeField(auto_now_add=True)
    activated_by = models.UUIDField(null=True, blank=True)

    class Meta:
        verbose_name = "Kill switch"
        verbose_name_plural = "Kill switches"
        constraints = [
            models.UniqueConstraint(
                fields=["feature_key", "tenant_id"],
                name="ac_kill_switch_unique_key_tenant",
            ),
        ]
        indexes = [
            models.Index(fields=["feature_key"]),
            models.Index(fields=["active"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"kill:{self.feature_key} {'ACTIVE' if self.active else 'inactive'}"


class RolloutAuditLog(models.Model):
    """Audit log for rollout/feature flag/experiment changes."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    performed_by = models.UUIDField(db_index=True)
    action = models.CharField(max_length=64)
    entity_type = models.CharField(
        max_length=32,
        help_text="feature_flag | experiment | kill_switch",
    )
    entity_id = models.UUIDField()
    changes = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Rollout audit log"
        verbose_name_plural = "Rollout audit logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant_id", "entity_type"]),
            models.Index(fields=["entity_id"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.action} {self.entity_type}:{self.entity_id}"


__all__ = [
    "PermissionService",
    "Permission",
    "Role",
    "RolePermission",
    "ScopeType",
    "RoleBinding",
    "PolicyAction",
    "PolicyOverride",
    "TenantAdminAuditEvent",
    "RolloutTargetType",
    "FeatureFlag",
    "Experiment",
    "KillSwitch",
    "RolloutAuditLog",
]
