from __future__ import annotations

import json
from typing import Any

from django.db import models

from activity.privacy import (
	decrypt_json,
	decrypt_text,
	encrypt_json,
	encrypt_text,
	is_encrypted_value,
)


class EncryptedTextField(models.TextField):
    description = "Text field encrypted at the application layer"

    def from_db_value(self, value, expression, connection):
        return self.to_python(value)

    def to_python(self, value):
        if value is None or value == "" or not isinstance(value, str):
            return value
        return decrypt_text(value)

    def get_prep_value(self, value: Any):
        value = super().get_prep_value(value)
        if value is None or value == "":
            return value
        return encrypt_text(str(value))


class EncryptedJSONField(models.TextField):
    description = "JSON field encrypted at the application layer"

    def from_db_value(self, value, expression, connection):
        return self.to_python(value)

    def to_python(self, value):
        if value is None:
            return None
        if isinstance(value, (dict, list, bool, int, float)):
            return value
        if value == "":
            return {}
        if not isinstance(value, str):
            return value
        return decrypt_json(value)

    def get_prep_value(self, value: Any):
        if value is None:
            return None
        if isinstance(value, str):
            if is_encrypted_value(value):
                return value
            try:
                json.loads(value)
            except json.JSONDecodeError:
                # Non-JSON string: serialize once, then encrypt
                return encrypt_text(json.dumps(value, ensure_ascii=False))
            else:
                # Already valid JSON string: encrypt directly
                return encrypt_text(value)
        return encrypt_json(value)