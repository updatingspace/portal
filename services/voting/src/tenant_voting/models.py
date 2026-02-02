from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone


class PollStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    ACTIVE = "active", "Active"
    CLOSED = "closed", "Closed"


class PollScopeType(models.TextChoices):
    TENANT = "TENANT", "TENANT"
    COMMUNITY = "COMMUNITY", "COMMUNITY"
    TEAM = "TEAM", "TEAM"
    EVENT = "EVENT", "EVENT"
    POST = "POST", "POST"


class PollVisibility(models.TextChoices):
    PUBLIC = "public", "public"
    COMMUNITY = "community", "community"
    TEAM = "team", "team"
    PRIVATE = "private", "private"


class ResultsVisibility(models.TextChoices):
    ALWAYS = "always", "always"
    AFTER_CLOSED = "after_closed", "after_closed"
    ADMINS_ONLY = "admins_only", "admins_only"


class NominationKind(models.TextChoices):
    GAME = "game", "game"
    REVIEW = "review", "review"
    PERSON = "person", "person"
    CUSTOM = "custom", "custom"


class PollRole(models.TextChoices):
    OWNER = "owner", "owner"
    ADMIN = "admin", "admin"
    MODERATOR = "moderator", "moderator"
    OBSERVER = "observer", "observer"
    PARTICIPANT = "participant", "participant"


class Poll(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_index=True)

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=PollStatus.choices, default=PollStatus.DRAFT)

    scope_type = models.CharField(max_length=16, choices=PollScopeType.choices)
    scope_id = models.CharField(max_length=128)

    visibility = models.CharField(max_length=16, choices=PollVisibility.choices, default=PollVisibility.PUBLIC)
    template = models.CharField(max_length=32, blank=True, default="")
    allow_revoting = models.BooleanField(default=False)
    anonymous = models.BooleanField(default=False)
    results_visibility = models.CharField(
        max_length=20,
        choices=ResultsVisibility.choices,
        default=ResultsVisibility.AFTER_CLOSED,
    )
    settings = models.JSONField(default=dict, blank=True)

    created_by = models.UUIDField()
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "voting_poll"
        indexes = [
            models.Index(fields=["tenant_id", "scope_type", "scope_id"], name="voting_poll_tenant_scope_idx"),
            models.Index(fields=["tenant_id", "status"], name="voting_poll_tenant_status_idx"),
        ]

    def save(self, *args, **kwargs):
        if not self.created_at:
            self.created_at = timezone.now()
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)


class Nomination(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_index=True)
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="nominations")

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    kind = models.CharField(
        max_length=20,
        choices=NominationKind.choices,
        default=NominationKind.CUSTOM,
    )
    sort_order = models.PositiveIntegerField(default=0, db_index=True)
    max_votes = models.PositiveIntegerField(default=1)
    is_required = models.BooleanField(default=False)
    config = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "voting_nomination"
        indexes = [
            models.Index(fields=["poll", "sort_order"], name="v_nom_poll_sort_idx"),
        ]
        constraints = [
            models.UniqueConstraint(fields=["poll", "sort_order"], name="voting_nomination_unique_sort"),
        ]
        ordering = ("sort_order", "id")

    def save(self, *args, **kwargs):
        if not self.tenant_id and self.poll:
            self.tenant_id = self.poll.tenant_id
        if not self.created_at:
            self.created_at = timezone.now()
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)


class Option(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_index=True)
    nomination = models.ForeignKey(Nomination, on_delete=models.CASCADE, related_name="options")

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    media_url = models.CharField(max_length=512, blank=True, default="")
    game_id = models.UUIDField(null=True, blank=True)
    sort_order = models.PositiveIntegerField(default=0, db_index=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "voting_option"
        indexes = [
            models.Index(fields=["nomination"], name="voting_option_nomination_idx"),
        ]
        ordering = ("sort_order", "id")

    def save(self, *args, **kwargs):
        if not self.tenant_id and self.nomination:
            self.tenant_id = self.nomination.tenant_id
        if not self.created_at:
            self.created_at = timezone.now()
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)


class PollParticipant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_index=True)
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="participants")
    user_id = models.UUIDField(db_index=True)
    role = models.CharField(max_length=16, choices=PollRole.choices)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "voting_poll_participant"
        constraints = [
            models.UniqueConstraint(fields=["poll", "user_id"], name="voting_poll_participant_unique"),
        ]

    def save(self, *args, **kwargs):
        if not self.tenant_id and self.poll:
            self.tenant_id = self.poll.tenant_id
        return super().save(*args, **kwargs)


class PollInviteStatus(models.TextChoices):
    PENDING = "pending", "pending"
    ACCEPTED = "accepted", "accepted"
    DECLINED = "declined", "declined"


class PollInvite(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_index=True)
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="invites")
    user_id = models.UUIDField(db_index=True)
    role = models.CharField(max_length=16, choices=PollRole.choices)
    invited_by = models.UUIDField()
    status = models.CharField(
        max_length=16, choices=PollInviteStatus.choices, default=PollInviteStatus.PENDING
    )
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "voting_poll_invite"
        constraints = [
            models.UniqueConstraint(fields=["poll", "user_id"], name="voting_poll_invite_unique"),
        ]

    def save(self, *args, **kwargs):
        if not self.tenant_id and self.poll:
            self.tenant_id = self.poll.tenant_id
        return super().save(*args, **kwargs)


class Vote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_index=True)

    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="votes")
    nomination = models.ForeignKey(Nomination, on_delete=models.CASCADE, related_name="votes")
    option = models.ForeignKey(Option, on_delete=models.CASCADE, related_name="votes")

    user_id = models.UUIDField(db_index=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "voting_vote"
        indexes = [
            models.Index(fields=["tenant_id", "poll"], name="voting_vote_tenant_poll_idx"),
            models.Index(fields=["tenant_id", "user_id"], name="voting_vote_tenant_user_idx"),
        ]


class OutboxMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    tenant_id = models.UUIDField(db_index=True)
    event_type = models.CharField(max_length=128, db_index=True)
    payload = models.JSONField(default=dict)

    occurred_at = models.DateTimeField(default=timezone.now)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "voting_outbox"
        indexes = [
            models.Index(fields=["tenant_id", "occurred_at"], name="v_outbox_tenant_occ_idx"),
            models.Index(fields=["event_type", "occurred_at"], name="v_outbox_type_occ_idx"),
            models.Index(fields=["published_at"], name="v_outbox_published_idx"),
        ]
