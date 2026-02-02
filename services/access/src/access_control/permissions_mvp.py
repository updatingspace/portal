from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PermissionSpec:
    key: str
    description: str
    service: str


MVP_PERMISSIONS: list[PermissionSpec] = [
    # portal (base)
    PermissionSpec(key="portal.profile.read_self", description="Access /me", service="portal"),
    PermissionSpec(key="portal.profile.edit_self", description="Edit /me", service="portal"),
    PermissionSpec(key="portal.applications.review", description="Admin applications", service="portal"),
    PermissionSpec(key="portal.communities.read", description="View communities", service="portal"),
    PermissionSpec(key="portal.communities.manage", description="Admin communities", service="portal"),
    PermissionSpec(key="portal.teams.manage", description="Admin teams", service="portal"),
    PermissionSpec(key="portal.communities.members.read", description="Read community members", service="portal"),
    PermissionSpec(key="portal.teams.members.read", description="Read team members", service="portal"),
    PermissionSpec(key="portal.posts.read", description="Read posts", service="portal"),
    PermissionSpec(key="portal.posts.create", description="Create posts", service="portal"),
    # Access control admin
    PermissionSpec(key="portal.roles.read", description="List roles for a service", service="portal"),
    PermissionSpec(key="portal.roles.write", description="Create/update roles for a service", service="portal"),
    PermissionSpec(key="portal.role_bindings.write", description="Create/delete role bindings", service="portal"),
    PermissionSpec(key="portal.permissions.read", description="List permission catalog", service="portal"),

    # voting
    PermissionSpec(key="voting.poll.read", description="Read polls", service="voting"),
    PermissionSpec(key="voting.vote.cast", description="Cast a vote", service="voting"),
    PermissionSpec(key="voting.results.read", description="Read voting results", service="voting"),
    PermissionSpec(key="voting.votings.admin", description="Manage votings (admin)", service="voting"),
    PermissionSpec(key="voting.nominations.admin", description="Manage nominations (admin)", service="voting"),
    
    # events
    PermissionSpec(key="events.event.read", description="Read events", service="events"),
    PermissionSpec(key="events.event.create", description="Create an event", service="events"),
    PermissionSpec(key="events.event.manage", description="Manage events", service="events"),
    PermissionSpec(key="events.rsvp.set", description="Set RSVP", service="events"),
    PermissionSpec(key="events.attendance.mark", description="Mark attendance", service="events"),
    
    # activity
    PermissionSpec(key="activity.feed.read", description="Read activity feed", service="activity"),
    PermissionSpec(key="activity.sources.link", description="Link sources", service="activity"),
    PermissionSpec(key="activity.sources.manage", description="Manage sources", service="activity"),
]
