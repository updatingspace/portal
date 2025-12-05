from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable

from django.db import transaction

from allauth.core import context
from allauth.mfa.models import Authenticator
from allauth.core.exceptions import ReauthenticationRequired
from ninja.errors import HttpError
from allauth.mfa.webauthn.internal import flows
from allauth.mfa.webauthn.internal import auth as webauthn_auth
from allauth.account.internal.flows.login import record_authentication
from django.contrib.auth import login as dj_login
from django.conf import settings

from accounts.transport.schemas import AuthenticatorsOut, AuthenticatorOut

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class PasskeyService:
    @staticmethod
    def list_authenticators(user) -> AuthenticatorsOut:
        auths = (
            Authenticator.objects.filter(
                user=user, type=Authenticator.Type.WEBAUTHN
            )
            .order_by("-created_at")
            .all()
        )
        return AuthenticatorsOut(
            authenticators=[
                AuthenticatorOut(
                    id=str(a.id),
                    name=a.data.get("name"),
                    type="webauthn",
                    created_at=int(a.created_at.timestamp()),
                    last_used_at=int(a.last_used_at.timestamp())
                    if a.last_used_at
                    else None,
                    is_passwordless=bool(
                        a.data.get("credential", {})
                        .get("clientExtensionResults", {})
                        .get("credProps", {})
                        .get("rk")
                    ),
                )
                for a in auths
            ]
        )

    @staticmethod
    def begin_registration(request, user, *, passwordless: bool = False) -> dict:
        try:
            with context.request_context(request):
                logger.info(
                    "Passkey registration started",
                    extra={
                        "user_id": getattr(user, "id", None),
                        "passwordless": passwordless,
                    },
                )
                return flows.begin_registration(
                    request, user, passwordless, signup=False
                )
        except ReauthenticationRequired:
            logger.warning(
                "Passkey registration requires reauthentication",
                extra={"user_id": getattr(user, "id", None)},
            )
            raise HttpError(401, "reauth_required")

    @staticmethod
    def complete_registration(request, name: str, credential: dict):
        try:
            with context.request_context(request):
                auth, rc = flows.add_authenticator(
                    request, name=name, credential=credential
                )
                logger.info(
                    "Passkey registration completed",
                    extra={
                        "user_id": getattr(request.user, "id", None),
                        "authenticator_id": str(getattr(auth, "id", "")),
                        "name": name,
                    },
                )
                return auth, rc
        except ReauthenticationRequired:
            logger.warning(
                "Passkey registration completion requires reauthentication",
                extra={"user_id": getattr(request.user, "id", None)},
            )
            raise HttpError(401, "reauth_required")

    @staticmethod
    @transaction.atomic
    def delete(request, user, ids: Iterable[str]) -> int:
        auths = list(
            Authenticator.objects.filter(
                user=user, type=Authenticator.Type.WEBAUTHN, id__in=list(ids)
            )
        )
        try:
            with context.request_context(request):
                flows.remove_authenticators(request, auths)
        except ReauthenticationRequired:
            logger.warning(
                "Passkey removal requires reauthentication",
                extra={"user_id": getattr(user, "id", None), "ids": list(ids)},
            )
            raise HttpError(401, "reauth_required")
        logger.info(
            "Passkeys removed",
            extra={
                "user_id": getattr(user, "id", None),
                "count": len(auths),
            },
        )
        return len(auths)

    @staticmethod
    def rename(request, authenticator_id: str, new_name: str) -> None:
        auth = Authenticator.objects.filter(
            user=request.user,
            type=Authenticator.Type.WEBAUTHN,
            id=authenticator_id,
        ).first()
        if not auth:
            return
        try:
            with context.request_context(request):
                flows.rename_authenticator(request, auth, new_name)
        except ReauthenticationRequired:
            logger.warning(
                "Passkey rename requires reauthentication",
                extra={"user_id": getattr(request.user, "id", None)},
            )
            raise HttpError(401, "reauth_required")
        logger.info(
            "Passkey renamed",
            extra={
                "user_id": getattr(request.user, "id", None),
                "authenticator_id": authenticator_id,
            },
        )

    @staticmethod
    def begin_login(request, user=None) -> dict:
        with context.request_context(request):
            logger.info(
                "Passkey login started",
                extra={"user_id": getattr(user, "id", None)},
            )
            return webauthn_auth.begin_authentication(user)

    @staticmethod
    def complete_login(request, credential: dict):
        with context.request_context(request):
            user = webauthn_auth.extract_user_from_response(credential)
            authenticator = webauthn_auth.complete_authentication(
                user, credential
            )
            record_authentication(
                request,
                method="mfa",
                type="webauthn",
                passwordless=True,
            )
            backend = getattr(user, "backend", None) or (
                settings.AUTHENTICATION_BACKENDS[0]
                if getattr(settings, "AUTHENTICATION_BACKENDS", None)
                else None
            )
            dj_login(request, user, backend=backend)
            logger.info(
                "Passkey login completed",
                extra={
                    "user_id": getattr(user, "id", None),
                    "authenticator_id": getattr(authenticator, "id", None),
                },
            )
            return user, authenticator


__all__ = ["PasskeyService"]
