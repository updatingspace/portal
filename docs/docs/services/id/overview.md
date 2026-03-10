---
title: UpdSpaceID
---

# UpdSpaceID

`UpdSpaceID` - это внешний identity provider, который участвует в runtime topology, но его исходники не лежат в этом репозитории.

## Что о нем важно знать разработчику portal repo

- BFF использует его как authority для login, signup, callback и account-related public auth paths.
- Dev topology поднимает `updspaceid` как контейнерный образ, а не как локальный сервис из исходников.
- Frontend не должен разговаривать с ним напрямую для основной продуктовой навигации; основная интеграция идет через BFF.

## What is in scope here

Внутри этого репозитория документируются только:

- какие identity endpoints проксирует BFF;
- какие callback flows ожидает BFF;
- какие данные `session/me` собирает поверх identity state.

## Main contract surface used by BFF

По коду BFF напрямую опирается на такие классы путей:

- browser login entrypoints;
- auth callback;
- public auth API paths вроде `login`, `signup`, `passkeys/login/complete`;
- account/session endpoints, доступные через BFF proxy layer.

## Design consequence

Если identity contract меняется, это почти всегда затрагивает:

- `services/bff/src/bff/api.py`;
- `services/bff/src/bff/session_store.py`;
- `web/portal-frontend/src/services/api.ts`.

Поэтому любые identity-related изменения сначала документируются в BFF разделе, а затем проверяются на frontend contract.
