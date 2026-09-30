from django.test import TestCase

from access_control.bootstrap import seed_access_defaults
from access_control.services import compute_effective_access
from access_control.tests.decision_contracts import exercise_decision_contracts


class AccessDecisionContractsTests(TestCase):
    def test_authorization_priority_scope_isolation_and_revocation(self):
        seed_access_defaults()
        self.assertGreaterEqual(
            exercise_decision_contracts(compute_effective_access), 40
        )
