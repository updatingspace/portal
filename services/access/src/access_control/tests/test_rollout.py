"""
Tests for rollout evaluation logic.

Comprehensive coverage of every branch in:
- _in_percentage
- _matches_target
- _assign_variant
- evaluate_rollout
"""

import hashlib
import uuid

from django.test import TestCase

from access_control.models import (
    Experiment,
    FeatureFlag,
    KillSwitch,
)
from access_control.rollout_services import (
    _assign_variant,
    _in_percentage,
    _matches_target,
    evaluate_rollout,
)


class PercentageRolloutTests(TestCase):
    def test_100_percent_always_in(self):
        self.assertTrue(_in_percentage("user123", "feature_x", 100))

    def test_0_percent_never_in(self):
        self.assertFalse(_in_percentage("user123", "feature_x", 0))

    def test_deterministic(self):
        """Same inputs should always produce the same result."""
        result1 = _in_percentage("user_abc", "flag_1", 50)
        result2 = _in_percentage("user_abc", "flag_1", 50)
        self.assertEqual(result1, result2)

    def test_different_users_may_differ(self):
        """With 50% rollout, at least some users should be in different buckets."""
        results = set()
        for i in range(100):
            results.add(_in_percentage(f"user_{i}", "test_flag", 50))
        self.assertEqual(results, {True, False})


class TargetMatchTests(TestCase):
    def setUp(self):
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()

    def test_all_target_matches(self):
        self.assertTrue(
            _matches_target(
                "all",
                {},
                self.user_id,
                self.tenant_id,
                "hash",
                "key",
            )
        )

    def test_user_list_matches(self):
        self.assertTrue(
            _matches_target(
                "user_list",
                {"user_ids": [str(self.user_id)]},
                self.user_id,
                self.tenant_id,
                "hash",
                "key",
            )
        )

    def test_user_list_no_match(self):
        self.assertFalse(
            _matches_target(
                "user_list",
                {"user_ids": [str(uuid.uuid4())]},
                self.user_id,
                self.tenant_id,
                "hash",
                "key",
            )
        )

    def test_tenant_list_matches(self):
        self.assertTrue(
            _matches_target(
                "tenant_list",
                {"tenant_ids": [str(self.tenant_id)]},
                self.user_id,
                self.tenant_id,
                "hash",
                "key",
            )
        )

    def test_unknown_target_type(self):
        self.assertFalse(
            _matches_target(
                "unknown",
                {},
                self.user_id,
                self.tenant_id,
                "hash",
                "key",
            )
        )


class VariantAssignmentTests(TestCase):
    def test_single_variant(self):
        result = _assign_variant("hash", "exp1", [{"name": "only", "weight": 100}])
        self.assertEqual(result, "only")

    def test_empty_variants(self):
        result = _assign_variant("hash", "exp1", [])
        self.assertEqual(result, "control")

    def test_deterministic(self):
        variants = [
            {"name": "control", "weight": 50},
            {"name": "treatment", "weight": 50},
        ]
        r1 = _assign_variant("consistent_hash", "exp_test", variants)
        r2 = _assign_variant("consistent_hash", "exp_test", variants)
        self.assertEqual(r1, r2)

    def test_all_variants_covered(self):
        """With many users, both variants should appear."""
        variants = [
            {"name": "A", "weight": 50},
            {"name": "B", "weight": 50},
        ]
        results = set()
        for i in range(200):
            results.add(_assign_variant(f"user_{i}", "coverage_test", variants))
        self.assertEqual(results, {"A", "B"})


class EvaluateRolloutTests(TestCase):
    def setUp(self):
        self.tenant_id = uuid.uuid4()
        self.user_id = uuid.uuid4()

    def test_empty_flags_and_experiments(self):
        flags, exps = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertEqual(flags, {})
        self.assertEqual(exps, {})

    def test_enabled_flag_all_target(self):
        FeatureFlag.objects.create(
            key="new_ui",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="all",
        )
        flags, _ = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertTrue(flags["new_ui"])

    def test_disabled_flag(self):
        FeatureFlag.objects.create(
            key="disabled_feature",
            tenant_id=self.tenant_id,
            enabled=False,
        )
        flags, _ = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertFalse(flags["disabled_feature"])

    def test_kill_switch_overrides_flag(self):
        FeatureFlag.objects.create(
            key="killable",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="all",
        )
        KillSwitch.objects.create(
            feature_key="killable",
            tenant_id=self.tenant_id,
            active=True,
        )
        flags, _ = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertFalse(flags["killable"])

    def test_inactive_kill_switch_does_not_override(self):
        FeatureFlag.objects.create(
            key="alive",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="all",
        )
        KillSwitch.objects.create(
            feature_key="alive",
            tenant_id=self.tenant_id,
            active=False,
        )
        flags, _ = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertTrue(flags["alive"])

    def test_global_flag_applies_to_tenant(self):
        FeatureFlag.objects.create(
            key="global_feature",
            tenant_id=None,
            enabled=True,
            target_type="all",
        )
        flags, _ = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertTrue(flags["global_feature"])

    def test_tenant_flag_overrides_global(self):
        FeatureFlag.objects.create(
            key="override_me",
            tenant_id=None,
            enabled=True,
        )
        FeatureFlag.objects.create(
            key="override_me",
            tenant_id=self.tenant_id,
            enabled=False,
        )
        flags, _ = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertFalse(flags["override_me"])

    def test_enabled_experiment(self):
        Experiment.objects.create(
            key="ab_test",
            tenant_id=self.tenant_id,
            enabled=True,
            variants=[
                {"name": "control", "weight": 50},
                {"name": "treatment", "weight": 50},
            ],
        )
        _, exps = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertIn(exps["ab_test"], ["control", "treatment"])

    def test_disabled_experiment_returns_control(self):
        Experiment.objects.create(
            key="off_experiment",
            tenant_id=self.tenant_id,
            enabled=False,
            variants=[{"name": "v1", "weight": 100}],
        )
        _, exps = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertEqual(exps["off_experiment"], "control")

    def test_kill_switch_overrides_experiment(self):
        Experiment.objects.create(
            key="killed_exp",
            tenant_id=self.tenant_id,
            enabled=True,
            variants=[{"name": "v1", "weight": 100}],
        )
        KillSwitch.objects.create(
            feature_key="killed_exp",
            tenant_id=self.tenant_id,
            active=True,
        )
        _, exps = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertEqual(exps["killed_exp"], "control")

    def test_user_list_flag(self):
        FeatureFlag.objects.create(
            key="user_only",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="user_list",
            target_value={"user_ids": [str(self.user_id)]},
        )
        flags, _ = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertTrue(flags["user_only"])

        # Different user should not match
        other_user = uuid.uuid4()
        flags2, _ = evaluate_rollout(self.tenant_id, other_user)
        self.assertFalse(flags2["user_only"])


# ===================================================================
# Additional edge-case tests for full branch coverage
# ===================================================================


class PercentageEdgeCaseTests(TestCase):
    """Cover edge cases in _in_percentage not tested above."""

    def test_negative_percentage(self):
        """Negative pct should behave like 0%."""
        self.assertFalse(_in_percentage("userX", "flag", -10))

    def test_over_100_percentage(self):
        """pct > 100 should behave like 100%."""
        self.assertTrue(_in_percentage("userX", "flag", 150))

    def test_1_percent(self):
        """1% should be deterministic — same user always same bucket."""
        r1 = _in_percentage("someuser", "f", 1)
        r2 = _in_percentage("someuser", "f", 1)
        self.assertEqual(r1, r2)

    def test_99_percent(self):
        """99% should include most users."""
        included = sum(1 for i in range(1000) if _in_percentage(f"u{i}", "f", 99))
        self.assertGreater(included, 900)  # Overwhelming majority

    def test_boundary_50(self):
        """50% should roughly split users evenly."""
        results = [_in_percentage(f"user_{i}", "half", 50) for i in range(1000)]
        true_count = sum(results)
        self.assertGreater(true_count, 350)
        self.assertLess(true_count, 650)


class TargetMatchEdgeCaseTests(TestCase):
    """Cover edge cases in _matches_target."""

    def setUp(self):
        self.user_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()
        self.hash = hashlib.sha256(str(self.user_id).encode()).hexdigest()

    def test_percent_target_with_50(self):
        """percent target_type delegates to _in_percentage."""
        result = _matches_target(
            "percent", {"pct": 50}, self.user_id, self.tenant_id, self.hash, "feat"
        )
        self.assertIsInstance(result, bool)

    def test_percent_target_with_100(self):
        self.assertTrue(
            _matches_target(
                "percent", {"pct": 100}, self.user_id, self.tenant_id, self.hash, "f"
            )
        )

    def test_percent_target_with_0(self):
        self.assertFalse(
            _matches_target(
                "percent", {"pct": 0}, self.user_id, self.tenant_id, self.hash, "f"
            )
        )

    def test_percent_target_non_numeric_pct(self):
        """Non-numeric pct should return False."""
        self.assertFalse(
            _matches_target(
                "percent",
                {"pct": "not_a_number"},
                self.user_id,
                self.tenant_id,
                self.hash,
                "f",
            )
        )

    def test_percent_target_missing_pct(self):
        """Missing pct key defaults to 0 → False."""
        self.assertFalse(
            _matches_target("percent", {}, self.user_id, self.tenant_id, self.hash, "f")
        )

    def test_percent_target_float_pct(self):
        """Float pct should be converted to int."""
        result = _matches_target(
            "percent", {"pct": 50.7}, self.user_id, self.tenant_id, self.hash, "f"
        )
        self.assertIsInstance(result, bool)

    def test_tenant_list_no_match(self):
        other = uuid.uuid4()
        self.assertFalse(
            _matches_target(
                "tenant_list",
                {"tenant_ids": [str(other)]},
                self.user_id,
                self.tenant_id,
                self.hash,
                "f",
            )
        )

    def test_tenant_list_empty(self):
        self.assertFalse(
            _matches_target(
                "tenant_list",
                {"tenant_ids": []},
                self.user_id,
                self.tenant_id,
                self.hash,
                "f",
            )
        )

    def test_user_list_empty(self):
        self.assertFalse(
            _matches_target(
                "user_list",
                {"user_ids": []},
                self.user_id,
                self.tenant_id,
                self.hash,
                "f",
            )
        )

    def test_user_list_multiple_users(self):
        """Match when user is one of many in the list."""
        user_ids = [str(uuid.uuid4()) for _ in range(5)] + [str(self.user_id)]
        self.assertTrue(
            _matches_target(
                "user_list",
                {"user_ids": user_ids},
                self.user_id,
                self.tenant_id,
                self.hash,
                "f",
            )
        )

    def test_tenant_list_multiple_tenants(self):
        tenant_ids = [str(uuid.uuid4()) for _ in range(5)] + [str(self.tenant_id)]
        self.assertTrue(
            _matches_target(
                "tenant_list",
                {"tenant_ids": tenant_ids},
                self.user_id,
                self.tenant_id,
                self.hash,
                "f",
            )
        )


class VariantAssignmentEdgeCaseTests(TestCase):
    """Cover edge cases in _assign_variant."""

    def test_zero_weight_variants(self):
        """All-zero weights → total_weight=0 → returns first variant name."""
        variants = [{"name": "zero_a", "weight": 0}, {"name": "zero_b", "weight": 0}]
        result = _assign_variant("hash", "exp", variants)
        self.assertEqual(result, "zero_a")

    def test_variant_without_name(self):
        """Missing 'name' key falls back to 'control'."""
        variants = [{"weight": 100}]
        result = _assign_variant("hash", "exp", variants)
        self.assertEqual(result, "control")

    def test_variant_without_weight(self):
        """Missing 'weight' defaults to 0."""
        variants = [{"name": "only"}]
        # All weights are 0 → total = 0 → returns first variant name
        result = _assign_variant("hash", "exp", variants)
        self.assertEqual(result, "only")

    def test_three_variants_coverage(self):
        """With three variants, all should appear across many users."""
        variants = [
            {"name": "A", "weight": 33},
            {"name": "B", "weight": 33},
            {"name": "C", "weight": 34},
        ]
        results = set()
        for i in range(500):
            results.add(_assign_variant(f"u{i}", "three_way", variants))
        self.assertEqual(results, {"A", "B", "C"})

    def test_heavily_skewed_weights(self):
        """99% weight A, 1% weight B — A should dominate."""
        variants = [{"name": "A", "weight": 99}, {"name": "B", "weight": 1}]
        results = [_assign_variant(f"u{i}", "skewed", variants) for i in range(1000)]
        a_count = results.count("A")
        self.assertGreater(a_count, 900)

    def test_single_variant_with_zero_weight(self):
        """Single variant with weight=0 → total=0 → returns first name."""
        result = _assign_variant("hash", "exp", [{"name": "solo", "weight": 0}])
        self.assertEqual(result, "solo")


class EvaluateRolloutEdgeCaseTests(TestCase):
    """Additional integration tests for evaluate_rollout."""

    def setUp(self):
        self.tenant_id = uuid.uuid4()
        self.user_id = uuid.uuid4()

    def test_percent_based_flag(self):
        """Flag with percent target_type works through evaluate_rollout."""
        FeatureFlag.objects.create(
            key="pct_flag",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="percent",
            target_value={"pct": 100},
        )
        flags, _ = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertTrue(flags["pct_flag"])

    def test_percent_flag_zero(self):
        FeatureFlag.objects.create(
            key="pct_zero",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="percent",
            target_value={"pct": 0},
        )
        flags, _ = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertFalse(flags["pct_zero"])

    def test_tenant_list_flag(self):
        FeatureFlag.objects.create(
            key="tenant_flag",
            tenant_id=None,  # global flag
            enabled=True,
            target_type="tenant_list",
            target_value={"tenant_ids": [str(self.tenant_id)]},
        )
        flags, _ = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertTrue(flags["tenant_flag"])

    def test_tenant_list_flag_no_match(self):
        other_tenant = uuid.uuid4()
        FeatureFlag.objects.create(
            key="tenant_miss",
            tenant_id=None,
            enabled=True,
            target_type="tenant_list",
            target_value={"tenant_ids": [str(other_tenant)]},
        )
        flags, _ = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertFalse(flags["tenant_miss"])

    def test_global_kill_switch_disables_tenant_flag(self):
        """Global kill switch (tenant_id=None) should affect all tenants."""
        FeatureFlag.objects.create(
            key="global_killable",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="all",
        )
        KillSwitch.objects.create(
            feature_key="global_killable",
            tenant_id=None,
            active=True,
        )
        flags, _ = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertFalse(flags["global_killable"])

    def test_global_kill_switch_on_experiment(self):
        Experiment.objects.create(
            key="exp_global_kill",
            tenant_id=self.tenant_id,
            enabled=True,
            variants=[{"name": "v1", "weight": 100}],
        )
        KillSwitch.objects.create(
            feature_key="exp_global_kill",
            tenant_id=None,
            active=True,
        )
        _, exps = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertEqual(exps["exp_global_kill"], "control")

    def test_experiment_user_list_no_match_returns_control(self):
        Experiment.objects.create(
            key="exp_user_list",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="user_list",
            target_value={"user_ids": [str(uuid.uuid4())]},
            variants=[{"name": "v1", "weight": 100}],
        )
        _, exps = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertEqual(exps["exp_user_list"], "control")

    def test_experiment_user_list_match_assigns_variant(self):
        Experiment.objects.create(
            key="exp_user_match",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="user_list",
            target_value={"user_ids": [str(self.user_id)]},
            variants=[{"name": "treatment", "weight": 100}],
        )
        _, exps = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertEqual(exps["exp_user_match"], "treatment")

    def test_global_experiment(self):
        Experiment.objects.create(
            key="global_exp",
            tenant_id=None,
            enabled=True,
            target_type="all",
            variants=[{"name": "A", "weight": 50}, {"name": "B", "weight": 50}],
        )
        _, exps = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertIn(exps["global_exp"], ["A", "B"])

    def test_tenant_experiment_overrides_global(self):
        Experiment.objects.create(
            key="override_exp",
            tenant_id=None,
            enabled=True,
            target_type="all",
            variants=[{"name": "global_v", "weight": 100}],
        )
        Experiment.objects.create(
            key="override_exp",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="all",
            variants=[{"name": "tenant_v", "weight": 100}],
        )
        _, exps = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertEqual(exps["override_exp"], "tenant_v")

    def test_experiment_with_non_list_variants(self):
        """If variants is not a list (e.g. dict or None), treat as empty → control."""
        exp = Experiment.objects.create(
            key="bad_variants",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="all",
        )
        # Force non-list variants directly
        Experiment.objects.filter(id=exp.id).update(variants={"not": "a list"})
        _, exps = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertEqual(exps["bad_variants"], "control")

    def test_auto_generated_user_key_hash(self):
        """When user_key_hash is empty, it's auto-generated from user_id."""
        FeatureFlag.objects.create(
            key="auto_hash_flag",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="percent",
            target_value={"pct": 100},
        )
        flags, _ = evaluate_rollout(self.tenant_id, self.user_id, user_key_hash="")
        self.assertTrue(flags["auto_hash_flag"])

    def test_explicit_user_key_hash(self):
        """Explicit user_key_hash is used for bucketing."""
        custom_hash = hashlib.sha256(b"custom").hexdigest()
        FeatureFlag.objects.create(
            key="explicit_hash",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="percent",
            target_value={"pct": 50},
        )
        flags1, _ = evaluate_rollout(
            self.tenant_id, self.user_id, user_key_hash=custom_hash
        )
        flags2, _ = evaluate_rollout(
            self.tenant_id, self.user_id, user_key_hash=custom_hash
        )
        self.assertEqual(flags1["explicit_hash"], flags2["explicit_hash"])

    def test_same_key_flag_and_experiment(self):
        """Flag and experiment with same key are independent."""
        FeatureFlag.objects.create(
            key="dual",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="all",
        )
        Experiment.objects.create(
            key="dual",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="all",
            variants=[{"name": "v1", "weight": 100}],
        )
        flags, exps = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertTrue(flags["dual"])
        self.assertEqual(exps["dual"], "v1")

    def test_kill_switch_same_key_disables_both(self):
        """Kill switch with same key disables both the flag and experiment."""
        FeatureFlag.objects.create(
            key="shared_key",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="all",
        )
        Experiment.objects.create(
            key="shared_key",
            tenant_id=self.tenant_id,
            enabled=True,
            target_type="all",
            variants=[{"name": "v1", "weight": 100}],
        )
        KillSwitch.objects.create(
            feature_key="shared_key",
            tenant_id=self.tenant_id,
            active=True,
        )
        flags, exps = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertFalse(flags["shared_key"])
        self.assertEqual(exps["shared_key"], "control")

    def test_multiple_flags_multiple_experiments(self):
        """Multiple flags and experiments are all evaluated independently."""
        for i in range(3):
            FeatureFlag.objects.create(
                key=f"multi_flag_{i}",
                tenant_id=self.tenant_id,
                enabled=True,
                target_type="all",
            )
        for i in range(2):
            Experiment.objects.create(
                key=f"multi_exp_{i}",
                tenant_id=self.tenant_id,
                enabled=True,
                target_type="all",
                variants=[{"name": f"v{i}", "weight": 100}],
            )
        flags, exps = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertEqual(len(flags), 3)
        self.assertEqual(len(exps), 2)
        for i in range(3):
            self.assertTrue(flags[f"multi_flag_{i}"])
        self.assertEqual(exps["multi_exp_0"], "v0")
        self.assertEqual(exps["multi_exp_1"], "v1")

    def test_different_tenants_isolated(self):
        """Flags for one tenant should not leak to another."""
        other_tenant = uuid.uuid4()
        FeatureFlag.objects.create(
            key="tenant_only",
            tenant_id=other_tenant,
            enabled=True,
            target_type="all",
        )
        flags, _ = evaluate_rollout(self.tenant_id, self.user_id)
        self.assertNotIn("tenant_only", flags)
