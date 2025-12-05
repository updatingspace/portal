from __future__ import annotations

import logging
from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction

User = get_user_model()
logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ProfileService:

    @staticmethod
    @transaction.atomic
    def update_name(
        user: User, *, first: str | None = None, last: str | None = None
    ) -> None:
        to_update: list[str] = []
        if first is not None:
            user.first_name = (first or "").strip()
            to_update.append("first_name")
        if last is not None:
            user.last_name = (last or "").strip()
            to_update.append("last_name")
        if to_update:
            user.save(update_fields=to_update)
            logger.info(
                "User profile name updated",
                extra={"user_id": getattr(user, "id", None), "fields": to_update},
            )

    @staticmethod
    def save_avatar(user: User, avatar: UploadedFile) -> bool:
        # Гарантируем наличие реального поля avatar перед сохранением
        has_field = False
        if hasattr(user, "_meta"):
            has_field = any(f.name == "avatar" for f in user._meta.concrete_fields)
        if not (has_field and hasattr(user, "avatar")):
            logger.info(
                "Avatar upload skipped: avatar field missing",
                extra={"user_id": getattr(user, "id", None)},
            )
            return False
        user.avatar.save(avatar.name, avatar)
        user.save(update_fields=["avatar"])
        logger.info(
            "Avatar updated",
            extra={"user_id": getattr(user, "id", None)},
        )
        return True
