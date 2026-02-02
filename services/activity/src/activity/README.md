# Activity Service (MVP)

Этот модуль реализует базовую "ленту активности" (Activity Feed) с мульти-tenant изоляцией.

## Tenant / Request ID

Все эндпоинты (включая webhooks) ожидают заголовки:

- `X-Request-Id`: строка
- `X-Tenant-Id`: UUID
- `X-Tenant-Slug`: slug

Внутри сервиса они валидируются через `core.http.require_context`.

## Auth (через BFF)

Большинство эндпоинтов (кроме webhook ingest) ожидают:

- `X-User-Id`: UUID пользователя (из UpdSpaceID)
- `X-Master-Flags`: опционально, строка флагов через запятую (например `system_admin,suspended`)

Админ-эндпоинты (например создание games и запуск sync) требуют `system_admin`.

## Коннекторы (расширяемые плагины)

Коннектор — это объект, реализующий интерфейс из `activity/connectors/base.py`:

- `describe()` -> capabilities
- `sync(account_link)` -> список RawEventIn
- `normalize(raw, account_link)` -> ActivityEvent (не сохранённый)
- `dedupe_key(raw)` -> строка (ключ для дедупликации)
- `rate_limits()` / `retry_policy()`

### Как добавить новый connector

1. Создайте файл `activity/connectors/<name>.py` и класс `<Name>Connector`.
2. Укажите `type` (например, `"discord"`). Он должен совпадать с `Source.type`.
3. Реализуйте методы интерфейса.
4. Зарегистрируйте коннектор в `activity/connectors/__init__.py` внутри `install_connectors()`.

## Webhook: Minecraft

Эндпоинт: `POST /api/activity/ingest/webhook/minecraft`

Подпись:

- Заголовок `X-Signature`: `sha256=<hex>`
- Секрет берётся из `MINECRAFT_WEBHOOK_SECRET` (или `ACTIVITY_MINECRAFT_WEBHOOK_SECRET`).

Дедупликация:

- `RawEvent` уникален по `(tenant_id, dedupe_hash)`.
- `ActivityEvent` уникален по `(tenant_id, source_ref)`.

## API (MVP)

- `GET /api/activity/feed?from_=&to=&types=&scope_type=&scope_id=`
- `POST /api/activity/subscriptions`
- `GET /api/activity/games`
- `POST /api/activity/games` (admin)
- `GET /api/activity/sources`
- `POST /api/activity/account-links`
- `POST /api/activity/sync/run?account_link_id=...` (admin/debug)
- `POST /api/activity/ingest/webhook/minecraft`
