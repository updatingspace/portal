from __future__ import annotations

from typing import Any
from uuid import UUID

from django.utils import timezone

from portal.models import (
    Community,
    CommunityMembership,
    PortalProfile,
    Post,
    Team,
    TeamMembership,
)

ANONYMIZED_USER_ID = UUID("00000000-0000-0000-0000-000000000000")
REDACTED_POST_TITLE = "[deleted]"
REDACTED_POST_BODY = "[deleted by user request]"


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _serialize_profile(profile: PortalProfile | None) -> dict[str, Any] | None:
    if profile is None:
        return None
    return {
        "tenant_id": str(profile.tenant_id),
        "user_id": str(profile.user_id),
        "username": profile.username,
        "display_name": profile.display_name,
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "bio": profile.bio,
        "created_at": _iso(profile.created_at),
        "updated_at": _iso(profile.updated_at),
    }


def _serialize_community(item: Community) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "name": item.name,
        "description": item.description,
        "created_by": str(item.created_by),
        "created_at": _iso(item.created_at),
        "updated_at": _iso(item.updated_at),
    }


def _serialize_team(item: Team) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "community_id": str(item.community_id),
        "name": item.name,
        "status": item.status,
        "created_by": str(item.created_by),
        "created_at": _iso(item.created_at),
        "updated_at": _iso(item.updated_at),
    }


def _serialize_membership(item: CommunityMembership | TeamMembership) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": item.id,
        "tenant_id": str(item.tenant_id),
        "user_id": str(item.user_id),
        "role_hint": item.role_hint,
        "created_at": _iso(item.created_at),
    }
    if isinstance(item, CommunityMembership):
        payload["community_id"] = str(item.community_id)
    else:
        payload["team_id"] = str(item.team_id)
    return payload


def _serialize_post(item: Post) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "tenant_id": str(item.tenant_id),
        "community_id": str(item.community_id) if item.community_id else None,
        "team_id": str(item.team_id) if item.team_id else None,
        "title": item.title,
        "body": item.body,
        "visibility": item.visibility,
        "created_by": str(item.created_by),
        "created_at": _iso(item.created_at),
    }


def export_user_data(*, tenant_id: UUID, user_id: UUID) -> dict[str, Any]:
    profile = PortalProfile.objects.filter(tenant_id=tenant_id, user_id=user_id).first()
    communities = list(
        Community.objects.filter(tenant_id=tenant_id, created_by=user_id).order_by("created_at")
    )
    teams = list(Team.objects.filter(tenant_id=tenant_id, created_by=user_id).order_by("created_at"))
    community_memberships = list(
        CommunityMembership.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("created_at")
    )
    team_memberships = list(
        TeamMembership.objects.filter(tenant_id=tenant_id, user_id=user_id).order_by("created_at")
    )
    posts = list(Post.objects.filter(tenant_id=tenant_id, created_by=user_id).order_by("created_at"))

    return {
        "service": "portal",
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "exported_at": timezone.now().isoformat(),
        "portal_profile": _serialize_profile(profile),
        "communities_created": [_serialize_community(item) for item in communities],
        "teams_created": [_serialize_team(item) for item in teams],
        "community_memberships": [_serialize_membership(item) for item in community_memberships],
        "team_memberships": [_serialize_membership(item) for item in team_memberships],
        "posts": [_serialize_post(item) for item in posts],
    }


def erase_user_data(*, tenant_id: UUID, user_id: UUID) -> dict[str, Any]:
    profiles_deleted, _ = PortalProfile.objects.filter(tenant_id=tenant_id, user_id=user_id).delete()
    community_memberships_deleted, _ = CommunityMembership.objects.filter(
        tenant_id=tenant_id,
        user_id=user_id,
    ).delete()
    team_memberships_deleted, _ = TeamMembership.objects.filter(
        tenant_id=tenant_id,
        user_id=user_id,
    ).delete()

    communities_anonymized = Community.objects.filter(
        tenant_id=tenant_id,
        created_by=user_id,
    ).update(created_by=ANONYMIZED_USER_ID)
    teams_anonymized = Team.objects.filter(
        tenant_id=tenant_id,
        created_by=user_id,
    ).update(created_by=ANONYMIZED_USER_ID)
    posts_redacted = Post.objects.filter(tenant_id=tenant_id, created_by=user_id).update(
        created_by=ANONYMIZED_USER_ID,
        title=REDACTED_POST_TITLE,
        body=REDACTED_POST_BODY,
    )

    return {
        "service": "portal",
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "mode": "hybrid",
        "erased_at": timezone.now().isoformat(),
        "counts": {
            "profiles_deleted": profiles_deleted,
            "community_memberships_deleted": community_memberships_deleted,
            "team_memberships_deleted": team_memberships_deleted,
            "communities_anonymized": communities_anonymized,
            "teams_anonymized": teams_anonymized,
            "posts_redacted": posts_redacted,
        },
    }
