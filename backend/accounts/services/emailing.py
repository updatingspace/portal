from __future__ import annotations
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from ninja.errors import HttpError
from allauth.account.adapter import get_adapter as get_account_adapter
from allauth.account.models import EmailAddress
from email_validator import EmailNotValidError, validate_email

User = get_user_model()
logger = logging.getLogger(__name__)


class EmailService:
    @staticmethod
    def status(user: User) -> dict:
        primary = EmailAddress.objects.filter(user=user, primary=True).first()
        email = (primary.email if primary else (user.email or "")) or ""
        verified = bool(primary and primary.verified)
        return {"email": email, "verified": verified}

    @staticmethod
    def request_change(request, user: User, *, new_email: str) -> None:
        try:
            email = get_account_adapter().clean_email(new_email or "")
            validate_email(email, check_deliverability=False)
        except (EmailNotValidError, Exception):
            logger.info(
                "Email change rejected: invalid email",
                extra={
                    "user_id": getattr(user, "id", None),
                    "email": new_email,
                },
            )
            raise HttpError(400, "Invalid email")
        if not email:
            raise HttpError(400, "Invalid email")

        primary = EmailAddress.objects.filter(user=user, primary=True).first()
        current = (primary.email if primary else user.email) or ""
        if email.lower() == (current or "").lower():
            logger.info(
                "Email change skipped: same as current",
                extra={"user_id": getattr(user, "id", None), "email": email},
            )
            return

        if getattr(settings, "ACCOUNT_UNIQUE_EMAIL", False):
            exists_verified_other = (
                EmailAddress.objects.filter(email__iexact=email, verified=True)
                .exclude(user=user)
                .exists()
            )
            if exists_verified_other:
                logger.warning(
                    "Email change rejected: email already verified by another user",
                    extra={"user_id": getattr(user, "id", None), "email": email},
                )
                raise HttpError(
                    400, "Этот email уже используется другим аккаунтом"
                )

        addr, _ = EmailAddress.objects.get_or_create(
            user=user,
            email=email,
            defaults={"verified": False, "primary": False},
        )
        addr.send_confirmation(request)
        logger.info(
            "Email change requested",
            extra={"user_id": getattr(user, "id", None), "email": email},
        )

    @staticmethod
    def resend_confirmation(request, user: User) -> None:
        primary = EmailAddress.objects.filter(user=user, primary=True).first()
        target = (
            primary
            if (primary and not primary.verified)
            else (
                EmailAddress.objects.filter(user=user, verified=False)
                .order_by("-id")
                .first()
            )
        )
        if not target:
            return
        target.send_confirmation(request)
        logger.info(
            "Resent email confirmation",
            extra={
                "user_id": getattr(user, "id", None),
                "email": getattr(target, "email", None),
            },
        )
