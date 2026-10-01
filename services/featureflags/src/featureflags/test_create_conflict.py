import json

from featureflags.models import FeatureFlag
from featureflags.tests import FeatureFlagsApiTests


class FeatureFlagCreationTests(FeatureFlagsApiTests):
    def test_duplicate_creation_does_not_replace_existing_flag(self):
        path = "/api/v1/flags"
        data = {
            "key": "community_calendar",
            "description": "Original",
            "enabled": True,
            "rollout": 100,
        }
        body = json.dumps(data).encode()
        response = self.client.post(
            path,
            data=body,
            content_type="application/json",
            **self._headers("POST", path, body),
        )
        self.assertEqual(response.status_code, 200, response.content)
        data.update(description="Replacement", enabled=False)
        body = json.dumps(data).encode()
        response = self.client.post(
            path,
            data=body,
            content_type="application/json",
            **self._headers("POST", path, body),
        )
        self.assertEqual(response.status_code, 409, response.content)
        flag = FeatureFlag.objects.get(key=data["key"])
        self.assertEqual(flag.description, "Original")
        self.assertTrue(flag.enabled)
