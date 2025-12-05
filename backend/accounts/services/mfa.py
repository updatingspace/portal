from __future__ import annotations

import base64
from dataclasses import dataclass
import logging
from typing import Optional

from django.shortcuts import get_object_or_404
from ninja.errors import HttpError

from allauth.core import context
from allauth.core.exceptions import ReauthenticationRequired
from allauth.mfa.adapter import get_adapter as get_mfa_adapter
from allauth.mfa.models import Authenticator
from allauth.mfa.totp.forms import ActivateTOTPForm, DeactivateTOTPForm
from allauth.mfa.totp.internal import flows as totp_flows
from allauth.mfa.recovery_codes.internal.auth import RecoveryCodes

from accounts.transport.schemas import (
    MfaStatusOut,
    TotpBeginOut,
)

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class MfaService:
    @staticmethod
    def status(user) -> MfaStatusOut:
        auths = Authenticator.objects.filter(user=user)
        has_totp = auths.filter(type=Authenticator.Type.TOTP).exists()
        has_webauthn = auths.filter(type=Authenticator.Type.WEBAUTHN).exists()
        rc = auths.filter(type=Authenticator.Type.RECOVERY_CODES).first()
        recovery_left = len(RecoveryCodes(rc).get_unused_codes()) if rc else 0
        return MfaStatusOut(
            has_totp=has_totp,
            has_webauthn=has_webauthn,
            has_recovery_codes=bool(rc),
            recovery_codes_left=recovery_left,
        )

    @staticmethod
    def totp_begin(request) -> TotpBeginOut:
        try:
            with context.request_context(request):
                form = ActivateTOTPForm(user=request.user)
                secret = form.secret
                adapter = get_mfa_adapter()
                otpauth_url = adapter.build_totp_url(request.user, secret)
                totp_svg = adapter.build_totp_svg(otpauth_url)
        except ReauthenticationRequired:
            logger.warning(
                "TOTP setup requires reauthentication",
                extra={"user_id": getattr(request.user, "id", None)},
            )
            raise HttpError(401, "reauth_required")
        svg_data_uri = (
            "data:image/svg+xml;base64,"
            + base64.b64encode(totp_svg.encode("utf-8")).decode("utf-8")
        )
        logger.info(
            "TOTP setup initiated",
            extra={"user_id": getattr(request.user, "id", None)},
        )
        return TotpBeginOut(
            secret=secret,
            otpauth_url=otpauth_url,
            svg=totp_svg,
            svg_data_uri=svg_data_uri,
        )

    @staticmethod
    def totp_confirm(request, code: str) -> list[str] | None:
        clean_code = (code or "").strip().replace(" ", "").replace("-", "")
        try:
            with context.request_context(request):
                form = ActivateTOTPForm(
                    user=request.user, data={"code": clean_code}
                )
                if not form.is_valid():
                    logger.info(
                        "TOTP confirmation failed validation",
                        extra={
                            "user_id": getattr(request.user, "id", None),
                            "errors": form.errors,
                        },
                    )
                    raise HttpError(400, form.errors)
                totp_auth, rc_auth = totp_flows.activate_totp(request, form)
                if rc_auth:
                    logger.info(
                        "TOTP confirmed with recovery codes issued",
                        extra={
                            "user_id": getattr(request.user, "id", None),
                            "recovery_codes": True,
                        },
                    )
                    return RecoveryCodes(rc_auth).get_unused_codes()
                logger.info(
                    "TOTP confirmed",
                    extra={"user_id": getattr(request.user, "id", None)},
                )
                return None
        except ReauthenticationRequired:
            logger.warning(
                "TOTP confirmation requires reauthentication",
                extra={"user_id": getattr(request.user, "id", None)},
            )
            raise HttpError(401, "reauth_required")

    @staticmethod
    def totp_disable(request) -> None:
        auth = get_object_or_404(
            Authenticator,
            user=request.user,
            type=Authenticator.Type.TOTP,
        )
        try:
            with context.request_context(request):
                form = DeactivateTOTPForm(authenticator=auth, data={})
                if not form.is_valid():
                    logger.info(
                        "TOTP disable failed validation",
                        extra={
                            "user_id": getattr(request.user, "id", None),
                            "errors": form.errors,
                        },
                    )
                    raise HttpError(400, form.errors)
                totp_flows.deactivate_totp(request, auth)
        except ReauthenticationRequired:
            logger.warning(
                "TOTP disable requires reauthentication",
                extra={"user_id": getattr(request.user, "id", None)},
            )
            raise HttpError(401, "reauth_required")
        logger.info(
            "TOTP disabled",
            extra={
                "user_id": getattr(request.user, "id", None),
                "authenticator_id": getattr(auth, "id", None),
            },
        )

    @staticmethod
    def regenerate_recovery_codes(request) -> list[str]:
        try:
            with context.request_context(request):
                rc = Authenticator.objects.filter(
                    user=request.user, type=Authenticator.Type.RECOVERY_CODES
                ).first()
                if rc:
                    rc.delete()
                rc_new = RecoveryCodes.activate(request.user)
                codes = RecoveryCodes(rc_new.instance).get_unused_codes()
                logger.info(
                    "Recovery codes regenerated",
                    extra={"user_id": getattr(request.user, "id", None)},
                )
                return codes
        except ReauthenticationRequired:
            logger.warning(
                "Recovery code regeneration requires reauthentication",
                extra={"user_id": getattr(request.user, "id", None)},
            )
            raise HttpError(401, "reauth_required")
        raise HttpError(400, "unable to regenerate codes")


__all__ = ["MfaService"]
