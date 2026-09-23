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

Пять независимых проверок capabilities через Access выполняются параллельно
в пределах одного запроса (не более пяти одновременно). У каждой сохраняются
исходные user/tenant context, HMAC, timeout и отдельное состояние HTTP-клиента.
Результаты объединяются после завершения всех проверок; ошибка одного сервиса
не удаляет результаты остальных. Права не кешируются между запросами, поэтому
следующая загрузка сессии снова обращается в Access. Это сокращает ожидание
независимых ответов, но не устраняет холодный старт сервисов.

### Tenant switch

`POST /session/switch-tenant` меняет active tenant внутри BFF session, не создавая новый identity account.

### Logout

Logout path ревокает текущую BFF session и чистит browser cookie. При необходимости BFF также может проксировать logout-related действия upstream.

## Session design constraints

- frontend не хранит session token как JS-visible secret;
- доменные сервисы не знают про browser cookie напрямую;
- BFF не передает `access_token`, `session_token` или `refresh_token` обратно в browser payload.

## Failure modes worth knowing

Вызовы ID через proxy и OIDC token/userinfo допускают 30 секунд ожидания данных
ответа (`BFF_ID_TIMEOUT_SECONDS`), чтобы холодный запуск ID не обрывался прежним
10-секундным read timeout. Connect/write/pool и остальные upstream используют
`BFF_PROXY_TIMEOUT_SECONDS` (10 секунд). Явный timeout отдельного запроса имеет
приоритет. Это предел бездействия при чтении, а не общий deadline или гарантия
скорости. Повторов обмена кода, периодического прогрева и готовых инстансов нет.

| Failure mode | Effect |
| --- | --- |
| identity callback invalid | login sequence does not materialize session |
| OIDC token endpoint returns malformed JSON or an invalid `access_token` | BFF redirects to `/login` with `auth_error=TOKEN_EXCHANGE_FAILED`, preserves `next`, and does not call userinfo or create a session |
| OIDC token/userinfo request times out | BFF redirects with `auth_error=UPSTREAM_UNAVAILABLE`; the code exchange is not automatically retried and its state remains consumed |
| tenant not selected | `session/me` может вернуть tenantless state |
| internal secret misconfigured | BFF не может безопасно подписывать internal requests |
| downstream profile unavailable | session still exists, but bootstrap becomes partial |
