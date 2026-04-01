from __future__ import annotations


def error_payload(code: str, message: str, details: dict | None = None) -> dict:
    payload: dict = {"code": code, "message": message}
    if details is not None:
        payload["details"] = details
    return payload
