---
title: BFF Session Lifecycle
---

# BFF Session Lifecycle

## Owned entities

`BffSession` - это основной persistent record browser session state в платформе.

## Main flows

### Login

1. frontend отправляет `POST /auth/login` или другой public auth path в BFF;
2. BFF проксирует запрос в UpdSpaceID;
3. на success BFF извлекает principal;
4. BFF сохраняет browser session;
5. BFF возвращает sanitized payload без bearer secrets в JS.

### Session bootstrap

`GET /session/me` возвращает:

- текущего пользователя;
- активный tenant;
- `portal_profile`, если он доступен;
- `id_profile` и membership-related сведения;
- `id_defaults`, если identity provider умеет отдавать portal-safe theme hint;
- capability probes для основных модулей, включая personalization.

### Tenant switch

`POST /session/switch-tenant` меняет active tenant внутри BFF session, не создавая новый identity account.

### Logout

Logout path ревокает текущую BFF session и чистит browser cookie. При необходимости BFF также может проксировать logout-related действия upstream.

## Session design constraints

- frontend не хранит session token как JS-visible secret;
- доменные сервисы не знают про browser cookie напрямую;
- BFF не передает `access_token`, `session_token` или `refresh_token` обратно в browser payload.

## Failure modes worth knowing

| Failure mode | Effect |
| --- | --- |
| identity callback invalid | login sequence does not materialize session |
| tenant not selected | `session/me` может вернуть tenantless state |
| internal secret misconfigured | BFF не может безопасно подписывать internal requests |
| downstream profile unavailable | session still exists, but bootstrap becomes partial |
