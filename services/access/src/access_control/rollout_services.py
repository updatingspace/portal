"""
Rollout evaluation logic.

Evaluates feature flags and experiments for a given user+tenant context.
Supports: kill switches, percentage rollout, user lists, tenant lists.
"""
from __future__ import annotations

import hashlib
import logging
from uuid import UUID

from django.db.models import Q

from access_control.models import (
    Experiment,
    FeatureFlag,
    KillSwitch,
)

logger = logging.getLogger(__name__)


def _in_percentage(user_key_hash: str, feature_key: str, pct: int) -> bool:
    """Deterministic percentage check using hash(user_key_hash + feature_key)."""
    if pct >= 100:
        return True
    if pct <= 0:
        return False
    digest = hashlib.sha256(f"{user_key_hash}:{feature_key}".encode()).hexdigest()
    bucket = int(digest[:8], 16) % 100
    return bucket < pct


def _matches_target(
    target_type: str,
    target_value: dict,
    user_id: UUID,
    tenant_id: UUID,
    user_key_hash: str,
    feature_key: str,
) -> bool:
    """Check if user matches the targeting rule."""
    if target_type == "all":
        return True
    if target_type == "percent":
        pct = target_value.get("pct", 0)
        if isinstance(pct, (int, float)):
            return _in_percentage(user_key_hash, feature_key, int(pct))
        return False
    if target_type == "user_list":
        user_ids = target_value.get("user_ids", [])
        return str(user_id) in [str(uid) for uid in user_ids]
    if target_type == "tenant_list":
        tenant_ids = target_value.get("tenant_ids", [])
        return str(tenant_id) in [str(tid) for tid in tenant_ids]
    return False


def _assign_variant(
    user_key_hash: str,
    experiment_key: str,
    variants: list[dict],
) -> str:
    """Deterministically assign a variant based on weighted distribution."""
    if not variants:
        return "control"

    total_weight = sum(v.get("weight", 0) for v in variants)
    if total_weight <= 0:
        return variants[0].get("name", "control")

    digest = hashlib.sha256(f"{user_key_hash}:exp:{experiment_key}".encode()).hexdigest()
    bucket = int(digest[:8], 16) % total_weight

    cumulative = 0
    for variant in variants:
        cumulative += variant.get("weight", 0)
        if bucket < cumulative:
            return variant.get("name", "control")

    return variants[-1].get("name", "control")


def evaluate_rollout(
    tenant_id: UUID,
    user_id: UUID,
    user_key_hash: str = "",
) -> tuple[dict[str, bool], dict[str, str]]:
    """Evaluate all feature flags and experiments for a user.

    Returns:
        (feature_flags, experiments)
        feature_flags: dict of flag_key -> bool
        experiments: dict of experiment_key -> variant_name
    """
    if not user_key_hash:
        user_key_hash = hashlib.sha256(str(user_id).encode()).hexdigest()

    # Collect kill switches
    kill_switches = set(
        KillSwitch.objects.filter(
            active=True,
        )
        .filter(Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True))
        .values_list("feature_key", flat=True)
    )

    # Evaluate feature flags
    flags_qs = FeatureFlag.objects.filter(
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True)
    ).order_by("key", "-tenant_id")  # tenant-specific first

    feature_flags: dict[str, bool] = {}
    seen_keys: set[str] = set()
    for flag in flags_qs:
        if flag.key in seen_keys:
            continue
        seen_keys.add(flag.key)

        if flag.key in kill_switches:
            feature_flags[flag.key] = False
            continue

        if not flag.enabled:
            feature_flags[flag.key] = False
            continue

        feature_flags[flag.key] = _matches_target(
            flag.target_type,
            flag.target_value or {},
            user_id,
            tenant_id,
            user_key_hash,
            flag.key,
        )

    # Evaluate experiments
    experiments_qs = Experiment.objects.filter(
        Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True)
    ).order_by("key", "-tenant_id")

    experiments: dict[str, str] = {}
    seen_exp_keys: set[str] = set()
    for exp in experiments_qs:
        if exp.key in seen_exp_keys:
            continue
        seen_exp_keys.add(exp.key)

        if exp.key in kill_switches:
            # Killed experiment -> assign "control"
            experiments[exp.key] = "control"
            continue

        if not exp.enabled:
            experiments[exp.key] = "control"
            continue

        if not _matches_target(
            exp.target_type,
            exp.target_value or {},
            user_id,
            tenant_id,
            user_key_hash,
            exp.key,
        ):
            experiments[exp.key] = "control"
            continue

        variants = exp.variants if isinstance(exp.variants, list) else []
        experiments[exp.key] = _assign_variant(user_key_hash, exp.key, variants)

    return feature_flags, experiments
