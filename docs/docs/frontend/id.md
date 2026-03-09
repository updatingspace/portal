---
title: Identity Integration
---

# Identity Integration

Локального `id-frontend` в этом репозитории сейчас нет. Поэтому frontend documentation по identity сводится к интеграции portal frontend с BFF и внешним UpdSpaceID.

## Current model

- login/signup/passkey completion идут через BFF auth paths;
- session bootstrap идет через `GET /session/me`;
- account-related actions идут через BFF account proxy;
- frontend не должен держать auth tokens как JS-visible secrets.

## Files to know

- `web/portal-frontend/src/services/api.ts`
- `web/portal-frontend/src/api/client.ts`
- `web/portal-frontend/src/app/guards/*`

## Migration note

Если локальный identity frontend когда-либо вернется в этот репозиторий, этот раздел нужно будет снова выделить в отдельный полноценный frontend chapter.
