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
]
