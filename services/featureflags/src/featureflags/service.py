from __future__ import annotations

from collections.abc import Iterable

from django.db import transaction
from django.utils import timezone

from .models import FeatureFlag, FeatureFlagAuditEvent, OutboxMessage


def _normalize_flag_key(key: str) -> str:
    return key.strip().lower().replace(" ", "_")


def _validate_rollout(rollout: int) -> None:
    if rollout < 0 or rollout > 100:
        raise ValueError("rollout must be between 0 and 100")


def evaluate_flags(flags: Iterable[FeatureFlag]) -> dict[str, bool]:
    return {flag.key: bool(flag.enabled and flag.rollout > 0) for flag in flags}


@transaction.atomic
def create_or_update_flag(
    *,
    actor_user_id: str,
    key: str,
    description: str | None,
    enabled: bool,
    rollout: int,
) -> tuple[FeatureFlag, str]:
    normalized_key = _normalize_flag_key(key)
    _validate_rollout(rollout)

    now = timezone.now()
    flag = FeatureFlag.objects.filter(key=normalized_key).first()
    action = "feature_flag.updated"
    if flag is None:
        action = "feature_flag.created"
        flag = FeatureFlag(
            key=normalized_key,
            created_by=actor_user_id,
            updated_by=actor_user_id,
            description=description or "",
            enabled=enabled,
            rollout=rollout,
        )
    else:
        flag.updated_by = actor_user_id
        flag.description = description or ""
        flag.enabled = enabled
        flag.rollout = rollout

    flag.save()

    metadata = {
        "enabled": flag.enabled,
        "rollout": flag.rollout,
        "description": flag.description,
        "updated_at": now.isoformat(),
    }

    FeatureFlagAuditEvent.objects.create(
        actor_user_id=actor_user_id,
        action=action,
        flag_key=flag.key,
        metadata=metadata,
    )
    OutboxMessage.objects.create(
        event_type=action,
        payload={"flag_key": flag.key, **metadata},
    )

    return flag, action


@transaction.atomic
def patch_flag(
    *,
    actor_user_id: str,
    key: str,
    description: str | None,
    enabled: bool | None,
    rollout: int | None,
) -> FeatureFlag:
    normalized_key = _normalize_flag_key(key)
    flag = FeatureFlag.objects.filter(key=normalized_key).first()
    if flag is None:
        raise FeatureFlag.DoesNotExist

    if rollout is not None:
        _validate_rollout(rollout)

    if description is not None:
        flag.description = description
    if enabled is not None:
        flag.enabled = enabled
    if rollout is not None:
        flag.rollout = rollout

    flag.updated_by = actor_user_id
    flag.save()

    metadata = {
        "enabled": flag.enabled,
        "rollout": flag.rollout,
        "description": flag.description,
        "updated_at": timezone.now().isoformat(),
    }

    FeatureFlagAuditEvent.objects.create(
        actor_user_id=actor_user_id,
        action="feature_flag.updated",
        flag_key=flag.key,
        metadata=metadata,
    )
    OutboxMessage.objects.create(
        event_type="feature_flag.updated",
        payload={"flag_key": flag.key, **metadata},
    )

    return flag
