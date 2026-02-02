from __future__ import annotations

from prometheus_client import Counter

VOTES_SUBMITTED = Counter(
    "voting_votes_submitted_total",
    "Total number of votes submitted",
    ["tenant", "poll"],
)

VOTES_DELETED = Counter(
    "voting_votes_deleted_total",
    "Number of votes revoked",
    ["tenant", "poll"],
)

POLL_RESULTS_QUERIES = Counter(
    "voting_poll_results_queries_total",
    "Number of times poll results were requested",
    ["tenant", "poll"],
)

INVITES_CREATED = Counter(
    "voting_poll_invites_created_total",
    "Number of poll invitations created",
    ["tenant", "poll"],
)

PARTICIPANTS_MANAGED = Counter(
    "voting_poll_participants_managed_total",
    "Number of participant role changes",
    ["tenant", "poll"],
)

POLLS_CREATED = Counter(
    "voting_polls_created_total",
    "Total number of polls created",
    ["tenant", "poll"],
)

NOMINATIONS_CREATED = Counter(
    "voting_nominations_created_total",
    "Total number of nominations created",
    ["tenant", "poll"],
)

OPTIONS_CREATED = Counter(
    "voting_options_created_total",
    "Total number of options created",
    ["tenant", "poll"],
)
