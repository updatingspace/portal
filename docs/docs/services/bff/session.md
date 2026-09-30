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
- `id_profile` из ID `/internal/identity/me` и memberships из Portal;
- `id_defaults`, если identity provider умеет отдавать portal-safe theme hint;
- capability probes для основных модулей, включая personalization.

### Tenant switch

`POST /session/switch-tenant` меняет active tenant внутри BFF session, не создавая новый identity account.

### Заявка на создание tenant

Авторизованный пользователь может подать заявку без memberships и без выбранного tenant:

```http
POST /api/v1/entry/tenant-applications
Content-Type: application/json
X-CSRF-Token: <csrf token>
Cookie: updspace_session=<session>

{
  "slug": "new-community",
  "name": "New Community",
  "description": "Описание сообщества"
}
```

BFF передаёт только `{slug, name, description}` в Portal
`POST /api/v1/portal/entry/tenant-applications`. Внутренний запрос подписан HMAC;
`X-User-Id` берётся из browser session, tenant-заголовки отсутствуют.
Поле email удалено из формы и контракта. Переданные клиентом email, user_id и
applicant_user_id игнорируются; рассылки при подаче заявки нет.

Portal сохраняет `applicant_user_id`, резервирует slug и возвращает `201`
с `{id, slug, status: "pending"}`. `GET /api/v1/entry/me` загружает собственные
заявки и членства из Portal, поэтому обновление страницы не теряет заявку.
Список содержит статусы `pending` и `provisioning`. Занятый или уже заявленный
slug даёт `409 SLUG_UNAVAILABLE`. Проверка 20 ожидающих заявок ограничивает
обычные последовательные подачи; это не строгий лимит конкурентных запросов.

Системный администратор использует tenantless API BFF:

- `GET /api/v1/entry/admin/tenant-applications`;
- `POST /api/v1/entry/admin/tenant-applications/{uuid}/approve`;
- `POST /api/v1/entry/admin/tenant-applications/{uuid}/reject`.

Одобрение создаёт tenant и outbox в Portal. Access выдаёт tenant-scoped роли
владельцу по сохранённому `applicant_user_id`. До подтверждения Access ответ —
`202`, статус — `provisioning`; после — `200`, `approved`, членство `active`.
Повторное одобрение безопасно. Ошибка Access оставляет задание для
`python src/manage.py process_outbox`; Terraform включает Portal в outbox sweep.
При `enable_outbox_task_containers=false` можно запустить тот же worker в
приватной Cloud Function: собрать ZIP через `scripts/ci/package-portal-outbox.py`
из проверенного Portal image digest и задать Terraform-переменную
`portal_outbox_function_zip`. Timer вызывает worker каждые 15 минут;
payload вызова не может одобрять заявки или выбирать владельца.
Без task-контейнера или функции необходим внешний запуск команды.
Системный администратор видит блок «Заявки на сообщества» на `/choose-tenant`: одобрение, отклонение и повтор настройки доступа доступны без выбора tenant.

`POST /session/switch-tenant` проверяет активное членство в Portal и регистрирует
в локальном справочнике BFF ровно UUID/slug, возвращённые Portal. При недоступности
Portal переключение завершается `502`, чужой tenant — `403`.

ID предоставляет identity-профиль и проверку активности аккаунта; модели и API
создания tenant принадлежат Portal. Legacy ID `/applications` пока обслуживает
регистрацию аккаунтов в существующем tenant. После одобрения BFF передаёт
возвращённый ID `user_id` в защищённый Portal `POST /portal/tenant-memberships`.
При сбое этого шага ответ `502 MEMBERSHIP_ENROLLMENT_PENDING` содержит `user_id`:
администратор может повторить через BFF `POST /api/v1/portal/tenant-memberships`
с `{user_id}` в исходном tenant-контексте. Запрос идемпотентен и не повышает
существующую роль или неактивное членство.

Протокол production-выпуска: [2026-09-30](../../guides/tenant-onboarding-release.md).

### Порядок выпуска и существующие членства

1. Выпустить ID с `/internal/identity/me`, стабильным `user_id` в ответе legacy
   approve и командой `export_portal_memberships`.
2. Выпустить Portal и Access, применить миграции (`migrate` для PostgreSQL,
   `migrate_ydb` для YDB). Выдача владельца в Access сама создаёт отсутствующие
   записи канонического каталога permissions, так как YDB не выполняет Django
   data migrations. Настроить `ACCESS_BASE_URL`; для private invoke в облаке
   используется `ACCESS_PRIVATE_INVOKE_AUTH=true` и runtime IAM token.
3. На время финального переноса приостановить legacy approvals либо сначала
   выпустить промежуточный BFF с записью одобрений одновременно в ID и Portal.
   Экспортировать
   доверенные UUID/slug/role/status из ID и импортировать в Portal:

   ```sh
   # Из services/id с доступом к исходной БД:
   python src/manage.py export_portal_memberships --output /secure/path/memberships.json
   # Из services/portal с доступом к целевой БД:
   python src/manage.py import_tenant_memberships --input /secure/path/memberships.json --dry-run
   python src/manage.py import_tenant_memberships --input /secure/path/memberships.json
   ```

   Импорт повторяемый и транзакционный; несоответствие UUID/slug останавливает
   перенос. Файл содержит идентификаторы пользователей: хранить и передавать
   его как внутренние данные, после проверки удалить. Контактные email не экспортируются.
4. Сверить членства, затем выпустить BFF/frontend и возобновить approvals.
   Старый кэш memberships BFF не используется. Без импорта старые пользователи
   увидят пустой список: автоматического fallback к ID нет.
5. Проверить подачу, обновление страницы, approve и вход владельца; проверить,
   что другой аккаунт не видит заявку и не может переключиться в этот tenant.

В serverless-конфигурации URL сервиса перед добавлением `/api/v1` должен быть
без завершающего `/`: двойной слеш меняет маршрут и подписываемый HMAC path.
Вызовы за TLS termination передают `X-Forwarded-Proto: https`, иначе Django
возвращает редирект. Административный review в BFF ждёт Portal до 30 секунд,
чтобы успеть получить `202 provisioning`, если Access не ответил за 10 секунд.

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

## Персонализация и обновление ленты

BFF проксирует `/api/v1/personalization/*` в Access `/api/v1/personalization/*`.
В частности, доступны `GET/PUT preferences`, `GET preferences/defaults` и
`GET admin/dashboards/layouts`. Маршруты используют обычную cookie-сессию,
активный tenant и CSRF для изменяющих запросов; браузер не вызывает Access напрямую.

`BFF_FEED_STREAMING_ENABLED` по умолчанию включён для окружений с поддержкой SSE.
В Yandex Serverless Containers он выключен: HTTP-вызов контейнера не поддерживает
используемую передачу потока с `Transfer-Encoding`
([ограничения платформы](https://yandex.cloud/en/docs/serverless-containers/concepts/invoke)).
В этом режиме авторизованный `GET /api/v1/activity/feed/live` возвращает конечный
ответ `200 text/event-stream` с событием `close`, причиной `polling` и интервалом
15 секунд. Клиент закрывает EventSource и обновляет ленту обычными GET-запросами.
Проверка сессии и соответствия tenant выполняется до выбора транспорта.
При ошибке SSE клиент также закрывает соединение, чтобы не переподключаться
параллельно с уже работающим опросом.
