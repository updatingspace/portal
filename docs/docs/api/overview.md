---
title: API and Contracts
---

# API and Contracts

Эта документация не дублирует весь OpenAPI побайтно. Вместо этого она фиксирует, где проходят основные contract boundaries.

## API tiers

| Tier | Consumer | Contract style |
| --- | --- | --- |
| Browser-facing | Portal Frontend | BFF routes, cookie session, normalized errors |
| Internal service | BFF and peer services | HMAC-signed requests with tenant/user headers |
| External dependency | BFF -> UpdSpaceID, connectors -> providers | provider-specific contracts |

## Naming conventions

- public API versioning идет через `/api/v1/...`;
- errors стремятся к envelope-формату с `code`, `message`, `details`, `request_id`;
- permission keys следуют формату `{service}.{resource}.{action}`.

## Where to inspect exact schemas

- Django Ninja runtime docs на конкретном сервисе;
- `schemas.py` внутри сервиса;
- focused tests в соответствующем сервисе;
- `web/portal-frontend/docs/bff-contract.md` для frontend-facing auth/session expectations.

## Rule for contributors

Если вы меняете endpoint contract:

1. меняете код;
2. обновляете этот docs set и профильный сервисный раздел;
3. обновляете frontend client или consumer tests;
4. фиксируете migration note, если контракт ломается.

### Leave a community

`POST /api/v1/entry/memberships/{tenant_id}/leave` is an authenticated,
CSRF-protected BFF operation for the current user only. The corresponding signed
Portal endpoint is `/api/v1/portal/entry/memberships/{tenant_id}/leave`.
No caller-supplied user ID is accepted. Success returns
`{"tenant_id": "…", "status": "left"}`; repeating the same exit is idempotent.

Portal changes only the user's membership in the specified tenant to `left`.
Accounts, posts and other communities are preserved. Departed users are excluded
from the member/achievement-recipient directory; their profiles remain available
for historical post attribution. A single `membership.left` audit event is stored
in the same transaction; idempotent repeats do not duplicate it. Owners receive
`409 OWNER_CANNOT_LEAVE`; ownership transfer is not implemented by this operation.
Unknown memberships return `404 MEMBERSHIP_NOT_FOUND`, other inactive memberships
`409 MEMBERSHIP_INACTIVE`, and concurrent changes `409 MEMBERSHIP_CHANGED`.
Rejoining is an administrative membership-restoration operation, not automatic enrollment.

Before enabling this flow, provision canonical Portal memberships and set
`BFF_ENFORCE_ACTIVE_MEMBERSHIP=true`. With this setting BFF verifies current
membership for every private request (including host-based sessions and system
administrators), fails closed on membership lookup errors (`503
MEMBERSHIP_UNAVAILABLE`), and returns `403 TENANT_FORBIDDEN` for departed users.
Without the gate the leave endpoint returns `503 LEAVE_UNAVAILABLE`. This provides
compatibility for installations still migrating to canonical Portal memberships.
After confirmed exit BFF clears that active tenant from all the user's sessions;
other tenants and the authenticated account remain available. No schema change
is required. The frontend drops private caches, informs other tabs and returns to
the community chooser. A lost response is reconciled against the membership list
before offering another submission.
