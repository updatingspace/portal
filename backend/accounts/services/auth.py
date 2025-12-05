from __future__ import annotations

import logging
from dataclasses import dataclass

from allauth.account.models import EmailAddress
from allauth.mfa.adapter import get_adapter as get_mfa_adapter
from allauth.socialaccount.models import SocialAccount
from django.contrib.auth import get_user_model
from django.contrib.auth import logout as dj_logout
from ninja.errors import HttpError
from ninja_jwt.tokens import RefreshToken

from accounts.transport.schemas import (
    ProfileOut,
    TokenPairOut,
    TokenRefreshIn,
    TokenRefreshOut,
)
from core.models import UserSessionMeta, UserSessionToken

User = get_user_model()
logger = logging.getLogger(__name__)


@dataclass(slots=True)
class AuthService:
    @staticmethod
    def issue_pair_for_session(request, user: User) -> TokenPairOut:
        if not getattr(user, "is_authenticated", False):
            raise HttpError(401, "Not authenticated")
        token = request.headers.get("X-Session-Token") or ""
        dj_key = request.session.session_key or ""

        meta = (
            UserSessionMeta.objects.filter(user=user, session_token=token).first()
            or UserSessionMeta.objects.filter(user=user, session_key=dj_key).first()
        )
        if not meta:
            meta = UserSessionMeta.objects.create(
                user=user,
                session_key=dj_key or token,
                session_token=token or None,
            )
        if dj_key and meta.session_key != dj_key:
            meta.session_key = dj_key
            meta.save(update_fields=["session_key"])

        rt = RefreshToken.for_user(user)
        at = rt.access_token

        UserSessionToken.objects.get_or_create(
            user=user, session_key=meta.session_key, refresh_jti=str(rt["jti"])
        )
        logger.info(
            "Issued JWT pair for session",
            extra={
                "user_id": getattr(user, "id", None),
                "session_key": meta.session_key,
                "has_header_session_token": bool(token),
            },
        )
        return TokenPairOut(access=str(at), refresh=str(rt))

    @staticmethod
    def logout_current(request) -> None:
        dj_logout(request)
        logger.info(
            "User logged out",
            extra={"user_id": getattr(getattr(request, "user", None), "id", None)},
        )

    @staticmethod
    def profile(user: User) -> ProfileOut:
        if not user or not getattr(user, "is_authenticated", False):
            raise HttpError(401, "Not authenticated")
        has_2fa = get_mfa_adapter().is_mfa_enabled(user)
        providers = list(
            SocialAccount.objects.filter(user=user).values_list("provider", flat=True)
        )
        primary = EmailAddress.objects.filter(user=user, primary=True).first()
        return ProfileOut(
            username=user.username,
            email=user.email,
            has_2fa=has_2fa,
            oauth_providers=providers,
            is_staff=bool(getattr(user, "is_staff", False)),
            is_superuser=bool(getattr(user, "is_superuser", False)),
            first_name=getattr(user, "first_name", None) or None,
            last_name=getattr(user, "last_name", None) or None,
            avatar_url=None,
            email_verified=bool(primary and primary.verified),
        )

    @staticmethod
    def change_password(user: User, current: str, new: str) -> None:
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError

        if not user.check_password(current):
            logger.warning(
                "Password change rejected: wrong current password",
                extra={"user_id": getattr(user, "id", None)},
            )
            raise HttpError(400, "wrong current password")
        if not (new and new.strip()):
            logger.info(
                "Password change rejected: empty new password",
                extra={"user_id": getattr(user, "id", None)},
            )
            raise HttpError(400, "new password cannot be empty")
        if current == new:
            logger.info(
                "Password change rejected: new password equals current",
                extra={"user_id": getattr(user, "id", None)},
            )
            raise HttpError(400, "new password must differ from current")
        try:
            validate_password(new, user=user)
        except ValidationError as e:
            logger.info(
                "Password change rejected: validation failed",
                extra={
                    "user_id": getattr(user, "id", None),
                    "errors": e.messages,
                },
            )
            raise HttpError(400, "; ".join(e.messages)) from e
        user.set_password(new)
        user.save(update_fields=["password"])
        logger.info(
            "Password changed successfully",
            extra={"user_id": getattr(user, "id", None)},
        )

    @staticmethod
    def refresh_pair(payload: TokenRefreshIn) -> TokenRefreshOut:
        try:
            rt = RefreshToken(payload.refresh)
        except Exception as err:
            logger.warning("Refresh token rejected: invalid token structure")
            raise HttpError(401, "invalid refresh") from err
        user = User.objects.filter(pk=rt.get("user_id")).first()
        if not user:
            logger.warning("Refresh token rejected: unknown user")
            raise HttpError(401, "invalid user")
        new_refresh = RefreshToken.for_user(user)
        logger.info(
            "Issued new token pair from refresh",
            extra={
                "user_id": getattr(user, "id", None),
            },
        )
        return TokenRefreshOut(refresh=str(new_refresh), access=str(rt.access_token))
