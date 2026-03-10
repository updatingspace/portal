# Data lifecycle & DSAR

## Что добавлено

В repo добавлен базовый DSAR/data-lifecycle слой для областей, отмеченных аудитом:

- self-service удаление аккаунта через BFF
- self-service export через `GET /api/v1/account/me/export`
- internal export/erase endpoints для `portal`, `activity`, `access`, `events`, `gamification`, `voting`
- service-level management commands для экспорта и erasure
- retention purge commands для `portal`, `activity`, `access`, `bff`, `events`, `gamification`, `voting`
- гибридная erasure-политика: системные/raw данные удаляются, пользовательский контент обезличивается
- PII-safe audit trail для `dsar.exported` / `dsar.erased`

## Self-service удаление аккаунта

BFF теперь обрабатывает `DELETE /api/v1/account/me` как оркестрацию:

1. вызывает internal erase в `portal`
2. вызывает internal erase в `activity`
3. вызывает internal erase в `access`
4. вызывает internal erase в `events`
5. вызывает internal erase в `gamification`
6. вызывает internal erase в `voting`
7. удаляет аккаунт в identity service
8. отзывает все BFF session records пользователя

Для self-service доступа к данным BFF также отдаёт агрегированный export:

- `GET /api/v1/account/me/export`

Frontend должен использовать именно `DELETE /account/me`, а не public auth proxy.

## Internal DSAR endpoints

### Portal

- `GET /api/v1/internal/dsar/users/{user_id}/export`
- `POST /api/v1/internal/dsar/users/{user_id}/erase`

### Activity

- `GET /api/v1/internal/dsar/users/{user_id}/export`
- `POST /api/v1/internal/dsar/users/{user_id}/erase`

### Access

- `GET /api/v1/access/internal/dsar/users/{user_id}/export`
- `POST /api/v1/access/internal/dsar/users/{user_id}/erase`

### Events

- `GET /api/v1/internal/dsar/users/{user_id}/export`
- `POST /api/v1/internal/dsar/users/{user_id}/erase`

### Gamification

- `GET /api/v1/gamification/internal/dsar/users/{user_id}/export`
- `POST /api/v1/gamification/internal/dsar/users/{user_id}/erase`

### Voting

- `GET /api/v1/internal/dsar/users/{user_id}/export`
- `POST /api/v1/internal/dsar/users/{user_id}/erase`

Все эти endpoints требуют internal HMAC signature. Разрешены:

- self-service вызов для самого пользователя
- вызов от `system_admin`

## Management commands

### Export / erase

В каждом затронутом сервисе доступна команда:

```bash
python manage.py dsar_user --tenant-id <tenant_uuid> --user-id <user_uuid> --action export
python manage.py dsar_user --tenant-id <tenant_uuid> --user-id <user_uuid> --action erase
```

Доступно в:

- `services/portal`
- `services/activity`
- `services/access`
- `services/bff`
- `services/events`
- `services/gamification`
- `services/voting`

### Retention purge

#### Activity

`python manage.py purge_retention --raw-events-days 30 --processed-outbox-days 14 --audit-days 365`

#### Access

`python manage.py purge_retention --audit-days 365`

#### BFF

`python manage.py purge_retention --session-days 30 --audit-days 365`

#### Portal

`python manage.py purge_retention --audit-days 365`

## Retention defaults

По умолчанию приняты следующие сроки:

- raw events: 30 дней
- processed outbox: 14 дней
- revoked/expired sessions: 30 дней
- portal/activity/BFF audit: 365 дней
- tenant admin audit: 365 дней

## Erasure policy

Принята `hybrid` стратегия:

- hard delete: account links, raw events, subscriptions, feed last seen, role bindings, policy overrides, BFF sessions
- anonymize/redact: portal posts, news posts/comments, activity events, tenant admin audit trail

## Activity privacy note

- При `POST /api/v1/account-links` сервис теперь сохраняет encrypted privacy metadata о правовом основании (`consent`, `consent_captured_at`, `captured_via`, `request_id`).
- Нормализованные Steam achievement/playtime events теперь хранятся в минимизированном виде и по умолчанию имеют `private` visibility.

## Operational note

Retention purge commands нужно запускать по расписанию. Минимально рекомендуемый режим — ежедневный cron/job в каждом сервисе.
