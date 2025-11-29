from __future__ import annotations

from datetime import datetime
from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError
from django.http import HttpRequest
from django.utils import timezone

from allauth.account import app_settings as allauth_settings
from allauth.account.models import EmailAddress

from .schemas import SessionSchema, UserSchema

User = get_user_model()


def serialize_user(user: Any) -> UserSchema:
    return UserSchema(
        id=user.id,
        username=user.get_username(),
        email=getattr(user, "email", None),
    )


def _now_iso() -> str:
    return timezone.now().isoformat()


def _parse_iso(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def get_client_ip(request: HttpRequest) -> str | None:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def ensure_session_key(request: HttpRequest) -> str:
    if not request.session.session_key:
        request.session.save()
    return request.session.session_key  # type: ignore[return-value]


def touch_session_metadata(request: HttpRequest) -> dict[str, Any]:
    ensure_session_key(request)
    meta = request.session.get("session_meta") or {}
    now_iso = _now_iso()
    meta.setdefault("created_at", now_iso)
    meta["last_seen_at"] = now_iso
    meta.setdefault("ip_address", get_client_ip(request))
    meta.setdefault("user_agent", (request.META.get("HTTP_USER_AGENT") or "")[:200])
    request.session["session_meta"] = meta
    request.session.modified = True
    return meta


def _session_schema_from_payload(
    session_key: str,
    meta: dict[str, Any],
    expires_at: datetime,
    current_session_key: str | None,
) -> SessionSchema:
    return SessionSchema(
        session_key=session_key,
        is_current=session_key == current_session_key,
        ip_address=meta.get("ip_address"),
        user_agent=meta.get("user_agent"),
        created_at=_parse_iso(meta.get("created_at")),
        last_seen_at=_parse_iso(meta.get("last_seen_at")),
        expires_at=expires_at,
    )


def get_current_session_schema(request: HttpRequest) -> SessionSchema:
    meta = touch_session_metadata(request)
    session_key = ensure_session_key(request)
    return _session_schema_from_payload(
        session_key=session_key,
        meta=meta,
        expires_at=request.session.get_expiry_date(),
        current_session_key=session_key,
    )


def list_user_sessions(user: Any, current_session_key: str | None = None) -> list[SessionSchema]:
    active_sessions = Session.objects.filter(expire_date__gt=timezone.now())
    result: list[SessionSchema] = []

    for session in active_sessions:
        try:
            data = session.get_decoded()
        except Exception:
            continue

        if data.get("_auth_user_id") != str(user.id):
            continue

        meta = data.get("session_meta") or {}
        result.append(
            _session_schema_from_payload(
                session_key=session.session_key,
                meta=meta,
                expires_at=session.expire_date,
                current_session_key=current_session_key,
            )
        )

    result.sort(
        key=lambda item: item.last_seen_at or item.created_at or item.expires_at,
        reverse=True,
    )
    return result


def revoke_session_for_user(session_key: str, user: Any) -> bool:
    try:
        session = Session.objects.get(session_key=session_key)
    except Session.DoesNotExist:
        return False

    try:
        data = session.get_decoded()
    except Exception:
        session.delete()
        return False

    if data.get("_auth_user_id") != str(user.id):
        return False

    session.delete()
    return True


def create_local_user(username: str, email: str, password: str):
    if User.objects.filter(username__iexact=username).exists():
        raise ValidationError("Пользователь с таким ником уже существует")

    if User.objects.filter(email__iexact=email).exists():
        raise ValidationError("Аккаунт с таким email уже существует")

    user = User(username=username, email=email)

    validate_password(password, user=user)

    user.set_password(password)
    user.full_clean()
    user.save()

    if email:
        EmailAddress.objects.update_or_create(
            user=user,
            email=email,
            defaults={
                "verified": allauth_settings.EMAIL_VERIFICATION == "none",
                "primary": True,
            },
        )

    return user
