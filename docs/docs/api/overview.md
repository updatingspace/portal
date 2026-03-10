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
