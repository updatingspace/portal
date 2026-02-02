from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone


class EventScopeType(models.TextChoices):
    TENANT = "TENANT", "TENANT"
    COMMUNITY = "COMMUNITY", "COMMUNITY"
    TEAM = "TEAM", "TEAM"


class EventVisibility(models.TextChoices):
    PUBLIC = "public", "public"
    COMMUNITY = "community", "community"
    TEAM = "team", "team"
    PRIVATE = "private", "private"


class RSVPStatus(models.TextChoices):
    INTERESTED = "interested", "interested"
    GOING = "going", "going"
    NOT_GOING = "not_going", "not_going"


class Event(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    tenant_id = models.UUIDField(db_index=True)

    scope_type = models.CharField(max_length=16, choices=EventScopeType.choices)
    scope_id = models.CharField(max_length=128)

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")

    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()

    location_text = models.CharField(max_length=255, blank=True, default="")
    location_url = models.URLField(blank=True, null=True)

    game_id = models.CharField(max_length=128, blank=True, null=True)

    visibility = models.CharField(
        max_length=16,
        choices=EventVisibility.choices,
        default=EventVisibility.PUBLIC,
        db_index=True,
    )

    created_by = models.UUIDField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "events_event"
        indexes = [
            models.Index(fields=["tenant_id", "starts_at"], name="events_event_tenant_start_idx"),
            models.Index(fields=["tenant_id", "ends_at"], name="events_event_tenant_end_idx"),
            models.Index(fields=["tenant_id", "scope_type", "scope_id"], name="events_event_tenant_scope_idx"),
        ]


class RSVP(models.Model):
    id = models.BigAutoField(primary_key=True)

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="rsvps")
    tenant_id = models.UUIDField(db_index=True)
    user_id = models.UUIDField(db_index=True)

    status = models.CharField(max_length=16, choices=RSVPStatus.choices)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "events_rsvp"
        constraints = [
            models.UniqueConstraint(fields=["tenant_id", "event", "user_id"], name="events_rsvp_unique"),
        ]
        indexes = [
            models.Index(fields=["tenant_id", "event"], name="events_rsvp_tenant_event_idx"),
            models.Index(fields=["tenant_id", "user_id"], name="events_rsvp_tenant_user_idx"),
        ]


class Attendance(models.Model):
    id = models.BigAutoField(primary_key=True)

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="attendance")
    tenant_id = models.UUIDField(db_index=True)
    user_id = models.UUIDField(db_index=True)

    marked_by = models.UUIDField()
    marked_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "events_attendance"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant_id", "event", "user_id"],
                name="events_attendance_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant_id", "event"], name="events_att_tenant_event_idx"),
            models.Index(fields=["tenant_id", "user_id"], name="events_att_tenant_user_idx"),
        ]


class OutboxMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    tenant_id = models.UUIDField(db_index=True)
    event_type = models.CharField(max_length=128, db_index=True)
    payload = models.JSONField(default=dict)

    occurred_at = models.DateTimeField(default=timezone.now)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "events_outbox"
        indexes = [
            models.Index(fields=["tenant_id", "occurred_at"], name="events_outbox_tenant_occ_idx"),
            models.Index(fields=["event_type", "occurred_at"], name="events_outbox_type_occ_idx"),
            models.Index(fields=["published_at"], name="events_outbox_published_idx"),
        ]
