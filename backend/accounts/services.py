from __future__ import annotations

import hashlib
import hmac
import time
from collections.abc import Iterable
from datetime import datetime
from typing import Any

from allauth.account import app_settings as allauth_settings
from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import HttpRequest
from django.utils import timezone
from django.utils.text import slugify

from .models import TelegramProfile
from .schemas import SessionSchema, UserSchema

User = get_user_model()


class TelegramAuthError(Exception):
    """
    Базовое исключение для проблем с Telegram-авторизацией.
    """


class TelegramAccountConflictError(TelegramAuthError):
    """
    Telegram-аккаунт уже занят или к пользователю привязан другой ID.
    """


class TelegramAuthExpiredError(TelegramAuthError):
    """
    Подпись от Telegram просрочена.
    """


class TelegramConfigError(TelegramAuthError):
    """
    Конфигурация для Telegram не настроена.
    """


def serialize_user(user: Any) -> UserSchema:
    telegram_profile = get_telegram_profile(user)
    return UserSchema(
        id=user.id,
        username=user.get_username(),
        email=getattr(user, "email", None),
        telegram_id=getattr(telegram_profile, "telegram_id", None),
        telegram_username=getattr(telegram_profile, "username", None),
        telegram_linked=telegram_profile is not None,
        is_staff=bool(getattr(user, "is_staff", False)),
        is_superuser=bool(getattr(user, "is_superuser", False)),
    )


def get_telegram_profile(user: Any) -> TelegramProfile | None:
    if not user:
        return None

    try:
        return user.telegram_profile  # type: ignore[attr-defined]
    except (AttributeError, TelegramProfile.DoesNotExist):
        return None
    except Exception:
        return None


def user_has_telegram_link(user: Any) -> bool:
    return get_telegram_profile(user) is not None


def _get_telegram_secret_key() -> bytes:
    token = getattr(settings, "TELEGRAM_BOT_TOKEN", "")
    if not token:
        raise TelegramConfigError("TELEGRAM_BOT_TOKEN не настроен")
    return hashlib.sha256(token.encode()).digest()


def validate_telegram_auth_payload(payload: dict[str, Any]) -> dict[str, Any]:
    required_fields = ["id", "first_name", "auth_date", "hash"]
    for field in required_fields:
        if payload.get(field) in (None, ""):
            raise TelegramAuthError(
                "Неполные данные Telegram: отсутствует обязательное поле"
            )

    secret_key = _get_telegram_secret_key()

    normalized_payload = {
        key: str(value)
        for key, value in payload.items()
        if key != "hash" and value not in (None, "")
    }
    data_check_string = "\n".join(
        f"{key}={normalized_payload[key]}" for key in sorted(normalized_payload.keys())
    )
    expected_hash = hmac.new(
        secret_key,
        msg=data_check_string.encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()

    received_hash = str(payload.get("hash") or "")
    if expected_hash.lower() != received_hash.lower():
        raise TelegramAuthError("Не удалось подтвердить подпись Telegram")

    try:
        auth_date = int(payload["auth_date"])
    except (TypeError, ValueError) as exc:
        raise TelegramAuthError("Некорректный формат времени авторизации") from exc

    max_age = int(getattr(settings, "TELEGRAM_LOGIN_MAX_AGE", 0) or 0)
    if max_age and auth_date < int(time.time()) - max_age:
        raise TelegramAuthExpiredError("Ссылка Telegram истекла, авторизуйтесь заново")

    return {**payload, "auth_date": auth_date}


def apply_privileges_from_telegram(user: Any, telegram_id: int) -> None:
    """
    Проставляет права (staff/superuser), если Telegram ID попадает в список TELEGRAM_ADMIN_IDS.
    """
    admin_ids = getattr(settings, "TELEGRAM_ADMIN_IDS", [])
    if not admin_ids:
        return

    if telegram_id not in admin_ids:
        return

    updated_fields: list[str] = []
    if not getattr(user, "is_staff", False):
        user.is_staff = True
        updated_fields.append("is_staff")
    if not getattr(user, "is_superuser", False):
        user.is_superuser = True
        updated_fields.append("is_superuser")

    if updated_fields:
        user.save(update_fields=updated_fields)


def grant_privileges_for_telegram_ids(
    telegram_ids: Iterable[int], *, staff: bool = True, superuser: bool = True
) -> list[Any]:
    """
    Удобный хелпер для выдачи прав по Telegram ID (например, из shell/cron).
    """
    granted: list[Any] = []
    for telegram_id in telegram_ids:
        profile = (
            TelegramProfile.objects.select_related("user")
            .filter(telegram_id=telegram_id)
            .first()
        )
        if not profile:
            continue

        user = profile.user
        updated_fields: list[str] = []
        if staff and not getattr(user, "is_staff", False):
            user.is_staff = True
            updated_fields.append("is_staff")
        if superuser and not getattr(user, "is_superuser", False):
            user.is_superuser = True
            updated_fields.append("is_superuser")

        if updated_fields:
            user.save(update_fields=updated_fields)
            granted.append(user)
    return granted


def _build_username_from_telegram(
    telegram_id: int,
    username: str | None,
    first_name: str | None,
    last_name: str | None,
) -> str:
    base = username or first_name or last_name or f"tg{telegram_id}"
    base_slug = slugify(base) or f"tg{telegram_id}"
    max_length = User._meta.get_field("username").max_length  # type: ignore[attr-defined]
    candidate = base_slug[:max_length]
    suffix = 1

    while User.objects.filter(username__iexact=candidate).exists():
        suffix_str = f"-{suffix}"
        truncated = base_slug[: max(max_length - len(suffix_str), 1)]
        candidate = f"{truncated}{suffix_str}"
        suffix += 1

    return candidate


@transaction.atomic
def create_user_from_telegram(payload: dict[str, Any]) -> Any:
    telegram_id = int(payload["id"])
    username = _build_username_from_telegram(
        telegram_id=telegram_id,
        username=payload.get("username"),
        first_name=payload.get("first_name"),
        last_name=payload.get("last_name"),
    )

    user = User.objects.create_user(
        username=username,
        email="",
    )
    user.first_name = payload.get("first_name") or ""
    user.last_name = payload.get("last_name") or ""
    user.set_unusable_password()
    user.save()
    return user


def _upsert_telegram_profile(user: Any, payload: dict[str, Any]) -> TelegramProfile:
    telegram_id = int(payload["id"])

    profile_for_user = get_telegram_profile(user)
    profile_for_id = (
        TelegramProfile.objects.select_related("user")
        .filter(telegram_id=telegram_id)
        .first()
    )

    if profile_for_user and profile_for_user.telegram_id != telegram_id:
        raise TelegramAccountConflictError(
            "У аккаунта уже есть другой Telegram. Сначала отвяжите его."
        )

    if profile_for_id and profile_for_id.user_id != getattr(user, "id", None):
        raise TelegramAccountConflictError(
            "Этот Telegram уже привязан к другому аккаунту."
        )

    profile = profile_for_user or profile_for_id or TelegramProfile(user=user)
    profile.telegram_id = telegram_id
    profile.username = payload.get("username") or ""
    profile.first_name = payload.get("first_name") or ""
    profile.last_name = payload.get("last_name") or ""
    profile.photo_url = payload.get("photo_url") or ""
    profile.auth_date = datetime.fromtimestamp(
        int(payload.get("auth_date") or time.time()),
        tz=timezone.utc,
    )
    profile.save()
    return profile


def authenticate_with_telegram(
    payload: dict[str, Any], current_user: Any | None = None
) -> Any:
    validated = validate_telegram_auth_payload(payload)
    telegram_id = int(validated["id"])

    with transaction.atomic():
        if current_user and getattr(current_user, "is_authenticated", False):
            user = current_user
        else:
            existing_profile = (
                TelegramProfile.objects.select_related("user")
                .filter(telegram_id=telegram_id)
                .first()
            )
            if existing_profile:
                user = existing_profile.user
            else:
                user = create_user_from_telegram(validated)

        _upsert_telegram_profile(user, validated)
        apply_privileges_from_telegram(user, telegram_id)
    return user


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


def list_user_sessions(
    user: Any, current_session_key: str | None = None
) -> list[SessionSchema]:
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


def drop_all_sessions_for_user(user: Any) -> None:
    """
    Завершает все активные сессии пользователя.
    """
    active_sessions = Session.objects.filter(expire_date__gt=timezone.now())
    for session in active_sessions:
        try:
            data = session.get_decoded()
        except Exception:
            continue

        if data.get("_auth_user_id") == str(user.id):
            session.delete()


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


def delete_user_and_related(user: Any) -> None:
    """
    Удаляет пользователя и все связанные с ним голоса/профиль Telegram.
    Сессии завершаются перед удалением.
    """
    try:
        from nominations.models import NominationVote

        NominationVote.objects.filter(user=user).delete()
    except Exception:
        # Если приложение недоступно, продолжим за счёт on_delete=CASCADE.
        pass

    drop_all_sessions_for_user(user)
    user.delete()
