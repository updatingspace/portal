from __future__ import annotations

from django.db import models


class Visibility(models.TextChoices):
    PUBLIC = "public", "public"
    COMMUNITY = "community", "community"
    TEAM = "team", "team"
    PRIVATE = "private", "private"


class TeamStatus(models.TextChoices):
    ACTIVE = "active", "active"
    ARCHIVED = "archived", "archived"
