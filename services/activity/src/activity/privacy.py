from __future__ import annotations

import base64
import hashlib
import json
import re
import threading
from typing import Any

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings

ENCRYPTED_PREFIX = "enc::"
REDACTED_VALUE = "[REDACTED]"

_SECRET_KEYS = {
    "access_token",
    "api_key",
    "apikey",
    "authorization",
    "client_secret",
    "cookie",
    "password",
    "refresh_token",
    "secret",
    "token",
}

_IDENTIFIER_KEYS = {
    "external_identity_ref",
    "personaname",
    "steam_id",
    "steamid",
}

_BEHAVIORAL_KEYS = {
    "achievement_description",
    "achievement_name",
    "game_name",
    "playtime_2weeks",
    "playtime_2weeks_minutes",
    "playtime_forever",
    "playtime_forever_minutes",
    "unlocktime",
}

_FULL_LOG_REDACTION_KEYS = {
    "config_json",
    "payload",
    "payload_json",
    "response_text",
    "settings_json",
}

_STEAM_ID_RE = re.compile(r"\b7656\d{13}\b")
_SECRET_QUERY_RE = re.compile(r"(?i)(api_key|key|token|secret)=([^&\s]+)")


def _normalize_key(key: str | None) -> str:
    if not key:
        return ""
    return re.sub(r"[^a-z0-9]+", "_", key.lower()).strip("_")


def _coerce_old_keys(value: Any) -> tuple[str, ...]:
    if not value:
        return ()
    if isinstance(value, str):
        items = value.split(",")
    else:
        items = value
    return tuple(str(item).strip() for item in items if str(item).strip())


def _encryption_materials() -> tuple[str, tuple[str, ...]]:
    primary = getattr(settings, "ACTIVITY_DATA_ENCRYPTION_KEY", "") or getattr(
        settings,
        "SECRET_KEY",
        "",
    )
    if not primary:
        raise RuntimeError("ACTIVITY_DATA_ENCRYPTION_KEY is not configured")
    old_keys = _coerce_old_keys(
        getattr(settings, "ACTIVITY_DATA_ENCRYPTION_OLD_KEYS", ()),
    )
    return primary, old_keys


def _derive_fernet_key(material: str) -> bytes:
    digest = hashlib.sha256(material.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)

def _build_fernet(primary: str, old_keys: tuple[str, ...]) -> MultiFernet:
    fernets = [Fernet(_derive_fernet_key(primary))]
    fernets.extend(
        Fernet(_derive_fernet_key(item))
        for item in old_keys
        if item and item != primary
    )
    return MultiFernet(fernets)


_FERNET_LOCK = threading.Lock()
_FERNET_CACHE: MultiFernet | None = None
_FERNET_CACHE_FINGERPRINT = ""


def _encryption_fingerprint(primary: str, old_keys: tuple[str, ...]) -> str:
    combined = "\0".join((primary, *old_keys))
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def _get_fernet() -> MultiFernet:
    primary, old_keys = _encryption_materials()
    fingerprint = _encryption_fingerprint(primary, old_keys)

    global _FERNET_CACHE
    global _FERNET_CACHE_FINGERPRINT

    with _FERNET_LOCK:
        if _FERNET_CACHE is None or _FERNET_CACHE_FINGERPRINT != fingerprint:
            _FERNET_CACHE = _build_fernet(primary, old_keys)
            _FERNET_CACHE_FINGERPRINT = fingerprint
        return _FERNET_CACHE


def is_encrypted_value(value: Any) -> bool:
    return isinstance(value, str) and value.startswith(ENCRYPTED_PREFIX)


def encrypt_text(value: str | None) -> str | None:
    if value is None:
        return None
    if value == "" or is_encrypted_value(value):
        return value
    token = _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")
    return f"{ENCRYPTED_PREFIX}{token}"


def decrypt_text(value: Any) -> Any:
    if value is None or value == "":
        return value
    if not isinstance(value, str):
        return value
    if not is_encrypted_value(value):
        return value

    token = value[len(ENCRYPTED_PREFIX) :]
    try:
        return _get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError(
            "Unable to decrypt sensitive Activity data; check encryption keys and rotation settings",
        ) from exc


def encrypt_json(value: Any) -> str | None:
    if value is None:
        return None
    serialized = json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return encrypt_text(serialized)


def decrypt_json(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dict, list, bool, int, float)):
        return value
    if value == "":
        return {}
    if not isinstance(value, str):
        return value

    decoded = decrypt_text(value)
    try:
        return json.loads(decoded)
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid JSON value in sensitive Activity field") from exc


def mask_identifier(value: Any, *, visible_suffix: int = 4) -> Any:
    if value is None or value == "":
        return value
    text = str(value)
    if len(text) <= visible_suffix:
        return "*" * len(text)
    masked_len = max(len(text) - visible_suffix, 4)
    return f"{'*' * masked_len}{text[-visible_suffix:]}"


def _sanitize_string_for_logs(value: str) -> str:
    sanitized = _SECRET_QUERY_RE.sub(
        lambda match: f"{match.group(1)}={REDACTED_VALUE}",
        value,
    )
    return _STEAM_ID_RE.sub(
        lambda match: str(mask_identifier(match.group(0))),
        sanitized,
    )


def mask_for_api(value: Any, *, key: str | None = None) -> Any:
    normalized_key = _normalize_key(key)

    if normalized_key in _SECRET_KEYS:
        return REDACTED_VALUE
    if normalized_key in _IDENTIFIER_KEYS:
        return mask_identifier(value)
    if isinstance(value, dict):
        return {k: mask_for_api(v, key=k) for k, v in value.items()}
    if isinstance(value, list):
        return [mask_for_api(item, key=key) for item in value]
    return value


def redact_for_log(value: Any, *, key: str | None = None) -> Any:
    normalized_key = _normalize_key(key)

    if normalized_key in _FULL_LOG_REDACTION_KEYS:
        return REDACTED_VALUE
    if normalized_key in _SECRET_KEYS or normalized_key in _BEHAVIORAL_KEYS:
        return REDACTED_VALUE
    if normalized_key in _IDENTIFIER_KEYS:
        return mask_identifier(value)
    if isinstance(value, dict):
        return {k: redact_for_log(v, key=k) for k, v in value.items()}
    if isinstance(value, list):
        return [redact_for_log(item, key=key) for item in value]
    if isinstance(value, str):
        return _sanitize_string_for_logs(value)
    return value


def safe_exception_label(exc: Exception | None) -> str:
    if exc is None:
        return "unknown"
    return exc.__class__.__name__
