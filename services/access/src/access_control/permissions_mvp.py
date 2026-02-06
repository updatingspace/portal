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
    PermissionSpec(key="portal.communities.list", description="List communities", service="portal"),
    PermissionSpec(key="portal.communities.create", description="Create communities", service="portal"),
    PermissionSpec(key="portal.communities.read", description="View communities", service="portal"),
    PermissionSpec(key="portal.communities.manage", description="Admin communities", service="portal"),
    PermissionSpec(key="portal.communities.members.manage", description="Manage community members", service="portal"),
    PermissionSpec(key="portal.teams.list", description="List teams", service="portal"),
    PermissionSpec(key="portal.teams.create", description="Create teams", service="portal"),
    PermissionSpec(key="portal.teams.manage", description="Admin teams", service="portal"),
    PermissionSpec(key="portal.communities.members.read", description="Read community members", service="portal"),
    PermissionSpec(key="portal.teams.members.read", description="Read team members", service="portal"),
    PermissionSpec(key="portal.teams.members.manage", description="Manage team members", service="portal"),
    PermissionSpec(key="portal.posts.read", description="Read posts", service="portal"),
    PermissionSpec(key="portal.posts.create", description="Create posts", service="portal"),
    PermissionSpec(key="portal.posts.create_public", description="Create public posts", service="portal"),
    PermissionSpec(key="portal.posts.create_community", description="Create community posts", service="portal"),
    PermissionSpec(key="portal.posts.create_team", description="Create team posts", service="portal"),
    PermissionSpec(key="portal.posts.create_private", description="Create private posts", service="portal"),
    PermissionSpec(key="portal.posts.read_private", description="Read private posts", service="portal"),
    # Access control admin
    PermissionSpec(key="portal.roles.read", description="List roles for a service", service="portal"),
    PermissionSpec(key="portal.roles.write", description="Create/update roles for a service", service="portal"),
    PermissionSpec(key="portal.role_bindings.write", description="Create/delete role bindings", service="portal"),
    PermissionSpec(key="portal.permissions.read", description="List permission catalog", service="portal"),

    # voting
    PermissionSpec(key="voting.poll.read", description="Read polls", service="voting"),
    PermissionSpec(key="voting.vote.cast", description="Cast a vote", service="voting"),
    PermissionSpec(key="voting.vote.read_own", description="Read own votes", service="voting"),
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
    PermissionSpec(key="activity.admin.sync", description="Run activity sync", service="activity"),
    PermissionSpec(key="activity.admin.games", description="Manage games catalog", service="activity"),
    PermissionSpec(key="activity.news.create", description="Create news posts", service="activity"),
    PermissionSpec(key="activity.news.manage", description="Manage news posts", service="activity"),

    # gamification
    PermissionSpec(key="gamification.achievements.read", description="Read achievements", service="gamification"),
    PermissionSpec(key="gamification.achievements.create", description="Create achievements", service="gamification"),
    PermissionSpec(key="gamification.achievements.edit", description="Edit achievements", service="gamification"),
    PermissionSpec(key="gamification.achievements.publish", description="Publish achievements", service="gamification"),
    PermissionSpec(key="gamification.achievements.hide", description="Hide achievements", service="gamification"),
    PermissionSpec(key="gamification.achievements.assign", description="Assign achievements", service="gamification"),
    PermissionSpec(key="gamification.achievements.revoke", description="Revoke achievements", service="gamification"),
    PermissionSpec(key="gamification.achievements.view_private", description="View private achievements", service="gamification"),
]


DEFAULT_MEMBER_ROLE_NAME = "member"

DEFAULT_MEMBER_ROLE_PERMISSIONS: dict[str, list[str]] = {
    "portal": [
        "portal.profile.read_self",
        "portal.profile.edit_self",
        "portal.communities.list",
        "portal.communities.read",
        "portal.teams.list",
        "portal.communities.members.read",
        "portal.teams.members.read",
        "portal.posts.read",
        "portal.posts.create_public",
        "portal.posts.create_community",
        "portal.posts.create_team",
        "portal.posts.create_private",
    ],
    "voting": [
        "voting.poll.read",
        "voting.vote.cast",
        "voting.vote.read_own",
        "voting.results.read",
    ],
    "events": [
        "events.event.read",
        "events.rsvp.set",
    ],
    "activity": [
        "activity.feed.read",
        "activity.sources.link",
        "activity.news.create",
    ],
    "gamification": [
        "gamification.achievements.read",
    ],
}
