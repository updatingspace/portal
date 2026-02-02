from __future__ import annotations

from django.db import models


class SourceType(models.TextChoices):
    STEAM = "steam", "steam"
    DISCORD = "discord", "discord"
    MINECRAFT = "minecraft", "minecraft"
    TRUCKERSMP = "truckersmp", "truckersmp"
    CUSTOM = "custom", "custom"


class AccountLinkStatus(models.TextChoices):
    ACTIVE = "active", "active"
    PENDING = "pending", "pending"
    DISABLED = "disabled", "disabled"
    ERROR = "error", "error"


class Visibility(models.TextChoices):
    PUBLIC = "public", "public"
    COMMUNITY = "community", "community"
    TEAM = "team", "team"
    PRIVATE = "private", "private"


class ScopeType(models.TextChoices):
    GLOBAL = "GLOBAL", "GLOBAL"
    TENANT = "TENANT", "TENANT"
    COMMUNITY = "COMMUNITY", "COMMUNITY"
    TEAM = "TEAM", "TEAM"
    SERVICE = "SERVICE", "SERVICE"
