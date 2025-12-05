from __future__ import annotations

import logging
from dataclasses import dataclass

from allauth.account.forms import SignupForm
from allauth.account.internal.flows.login import record_authentication
from allauth.account.utils import perform_login
from allauth.mfa.adapter import get_adapter as get_mfa_adapter
from allauth.mfa.models import Authenticator
from allauth.mfa.recovery_codes.internal.auth import RecoveryCodes
from allauth.mfa.totp.internal.auth import TOTP
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth import login as dj_login
from django.utils.module_loading import import_string
from ninja.errors import HttpError

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class HeadlessService:
    @staticmethod
    def issue_session_token(request) -> str:
        Strategy = import_string(
            getattr(
                settings,
                "HEADLESS_TOKEN_STRATEGY",
                "allauth.headless.tokens.sessions.SessionTokenStrategy",
            )
        )
        return Strategy().create_session_token(request)

    @staticmethod
    def login(
        request,
        email: str,
        password: str,
        *,
        mfa_code: str | None = None,
        recovery_code: str | None = None,
    ) -> str:
        from django.contrib.auth import get_user_model

        User = get_user_model()
        user_obj = User.objects.filter(email__iexact=email.strip()).first()
        if not user_obj:
            logger.warning(
                "Headless login failed: user not found",
                extra={"email": email.strip().lower()},
            )
            raise HttpError(400, "invalid credentials")
        user = authenticate(
            request, username=getattr(user_obj, "username", ""), password=password
        )
        if not user:
            logger.warning(
                "Headless login failed: invalid password",
                extra={"user_id": getattr(user_obj, "id", None), "email": email},
            )
            raise HttpError(400, "invalid credentials")
        record_authentication(request, method="password", email=email.strip())

        adapter = get_mfa_adapter()
        mfa_enabled = adapter.is_mfa_enabled(user)
        mfa_used: str | None = None
        if mfa_enabled:
            code = (mfa_code or recovery_code or "").strip().replace(" ", "")
            if not code:
                logger.info(
                    "Headless login requires MFA code",
                    extra={
                        "user_id": getattr(user, "id", None),
                        "email": email,
                        "mfa_enabled": True,
                    },
                )
                raise HttpError(401, "mfa_required")
            totp_auth = Authenticator.objects.filter(
                user=user, type=Authenticator.Type.TOTP
            ).first()
            rc_auth = Authenticator.objects.filter(
                user=user, type=Authenticator.Type.RECOVERY_CODES
            ).first()
            validated = False
            if totp_auth and TOTP(totp_auth).validate_code(code):
                validated = True
                mfa_used = "totp"
                record_authentication(
                    request, method="mfa", type="totp", passwordless=False
                )
            elif rc_auth and RecoveryCodes(rc_auth).validate_code(code):
                validated = True
                mfa_used = "recovery_code"
                record_authentication(request, method="mfa", type="recovery_codes")
            if not validated:
                logger.warning(
                    "Headless login failed: invalid MFA code",
                    extra={
                        "user_id": getattr(user, "id", None),
                        "email": email,
                        "mfa_enabled": True,
                    },
                )
                raise HttpError(400, "invalid_mfa_code")

        # Bypass allauth stage controller to stay headless and avoid redirects.
        dj_login(
            request, user, backend=user.backend if hasattr(user, "backend") else None
        )
        logger.info(
            "Headless login succeeded",
            extra={
                "user_id": getattr(user, "id", None),
                "email": email,
                "mfa_enabled": mfa_enabled,
                "mfa_method": mfa_used,
            },
        )
        return HeadlessService.issue_session_token(request)

    @staticmethod
    def signup(request, username: str, email: str | None, password: str) -> str:
        form = SignupForm(
            data={
                "username": username,
                "email": email or "",
                "password1": password,
                "password2": password,
            }
        )
        if not form.is_valid():
            logger.info(
                "Signup rejected due to validation errors",
                extra={
                    "username": username,
                    "email": email,
                    "errors": form.errors,
                },
            )
            raise HttpError(400, form.errors.as_json())
        user = form.save(request)
        record_authentication(request, method="password", username=username.strip())
        perform_login(request, user)
        logger.info(
            "Headless signup succeeded",
            extra={
                "user_id": getattr(user, "id", None),
                "username": username,
                "email": email,
            },
        )
        return HeadlessService.issue_session_token(request)
