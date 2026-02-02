from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone

from portal.enums import TeamStatus, Visibility


class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "portal_tenant"
        indexes = [
            models.Index(fields=["slug"], name="portal_tenant_slug_idx"),
        ]


class PortalProfile(models.Model):
    id = models.BigAutoField(primary_key=True)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="profiles")
    user_id = models.UUIDField()
    first_name = models.CharField(max_length=128)
    last_name = models.CharField(max_length=128)
    bio = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "portal_profile"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "user_id"], name="portal_profile_tenant_user_uniq"
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "user_id"], name="portal_profile_tenant_user_idx"),
        ]


class Community(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="communities")
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    created_by = models.UUIDField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "portal_community"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "name"], name="portal_community_tenant_name_uniq"
            ),
        ]
        indexes = [
            models.Index(fields=["tenant"], name="portal_community_tenant_idx"),
        ]


class CommunityMembership(models.Model):
    id = models.BigAutoField(primary_key=True)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="community_memberships")
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name="memberships")
    user_id = models.UUIDField()
    role_hint = models.CharField(max_length=64, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "portal_community_membership"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "community", "user_id"],
                name="portal_comm_member_tenant_comm_user_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "community"], name="p_cmem_tnt_comm_idx"),
            models.Index(fields=["tenant", "user_id"], name="p_cmem_tnt_user_idx"),
        ]


class Team(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="teams")
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name="teams")
    name = models.CharField(max_length=128)
    status = models.CharField(max_length=16, choices=TeamStatus.choices, default=TeamStatus.ACTIVE)
    created_by = models.UUIDField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "portal_team"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "community", "name"],
                name="portal_team_tenant_comm_name_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "community"], name="portal_team_tenant_comm_idx"),
        ]


class TeamMembership(models.Model):
    id = models.BigAutoField(primary_key=True)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="team_memberships")
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="memberships")
    user_id = models.UUIDField()
    role_hint = models.CharField(max_length=64, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "portal_team_membership"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "team", "user_id"],
                name="portal_team_member_tenant_team_user_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "team"], name="p_tmem_tnt_team_idx"),
            models.Index(fields=["tenant", "user_id"], name="p_tmem_tnt_user_idx"),
        ]


class Post(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="posts")
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name="posts",
        null=True,
        blank=True,
    )
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="posts",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=256)
    body = models.TextField()
    visibility = models.CharField(max_length=16, choices=Visibility.choices)
    created_by = models.UUIDField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "portal_post"
        indexes = [
            models.Index(fields=["tenant", "visibility"], name="portal_post_tenant_vis_idx"),
            models.Index(fields=["tenant", "community"], name="portal_post_tenant_comm_idx"),
            models.Index(fields=["tenant", "team"], name="portal_post_tenant_team_idx"),
            models.Index(fields=["tenant", "created_at"], name="portal_post_tenant_created_idx"),
        ]


__all__ = [
    "Tenant",
    "PortalProfile",
    "Community",
    "CommunityMembership",
    "Team",
    "TeamMembership",
    "Post",
]
