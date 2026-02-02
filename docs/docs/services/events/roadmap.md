---
sidebar_position: 2
title: Roadmap
description: Как мы выводим Events сервис из MVP в production
---

# Events Service Roadmap

## Текущее состояние
- Events CRUD, RSVP, attendance и visibility-логика уже доступны через `services/events` API.
- `events.event.read/create/manage`, `events.rsvp.set` и `events.attendance.mark` зарегистрированы в Access service и покрыты unit-тестами (`services/events/src/events/tests.py`).
- Event outbox фиксирует `event.created`, `event.updated`, `event.rsvp.changed` и позволяет downstream-сервисам реагировать на события, но пока не работает в проде.
- Валидация входных данных, `rsvpCounts` и `myRsvp` присутствуют в API, но membership-проверки и роль-права ещё нуждаются в доработке.

## Готовность к production: пробелы и риски
1. **Контекст видимости.** Мы ещё не используем Portal или Access service для явной проверки членства по scope (COMMUNITY/TEAM), поэтому `list`/`get` могут возвращать события пользователям без соответствующей принадлежности.
2. **Outbox pipeline.** Outbox создаётся, но нет долгоживущего обработчика, который бы пушил события в Activity или другие потребители, и не ведётся учёт ошибочных попыток.
3. **Access + роли.** Tenant-админ пока не управляет участниками/организаторами, оставляя это системному администратору; нужна чёткая схема ролей и кнопка в Access service.
4. **Observability.** Нужны health/metrics/trace, чтобы убедиться в работе сигнатур, Outbox и API.
5. **Документация + контракты.** Нужен roadmap, OpenAPI и чёткие описания, что отдаёт `rsvpCounts`, `myRsvp`, какие master-flags обрабатываются.

## Фаза 0: укрепляем основы (Tenant scope, данные, проверка входа)
1. **Membership & visibility.** Обновить `_event_visible_for_user` и `has_scope_membership`, чтобы обращаться в Portal (напр. `GET /communities/{id}/members/{user_id}` / `/teams/…`) и учитывать реальные membership-статусы. Добавить fallback: `events.event.read` через Access service, но с trace-параметрами, чтобы не раскрывать private/community события.
2. **Валидаторы и `scope`-тип.** Стандартизировать `scope_id` (UUID для tenant/community/team) и добавить ещё одну проверку `scope_type`/`visibility` (например, community visibility только для community scope). Покрыть unit-тестами.
3. **Outbox consumer skeleton.** Реализовать `management/commands/process_event_outbox.py`, который читает `events_outbox`, отправляет события (HMAC + `BFF_INTERNAL_HMAC_SECRET`) в Activity service или другие подписчики, обрабатывает retry/backoff и отмечает `published_at`/`error`. Также добавить возможность dry-run + metrics.
4. **Health & metrics.** Расширить `/health` и добавить `/metrics` (JSON) с `events_total`, `rsvp_total`, `outbox_pending`, `outbox_failed`. Настроить structured logging и включить обязательные env-переменные (`BFF_INTERNAL_HMAC_SECRET`, `ACCESS_BASE_URL`).
5. **Документация API.** Уточнить контракты (обязательные поля, `rsvpCounts` всегда содержит все статусы, `meta.total` vs limit). Обновить OpenAPI (или `documentation/docs/api/overview.md`) и добавить примеры ошибок и HMAC requirements.

## Фаза 1: доступ/роли и административный контроль
1. **Роли и permissions.** В Access service зарезервировать две роли для Events: `events.participant` (`events.event.read`, `events.rsvp.set`) и `events.organizer` (`events.event.create`, `events.event.manage`, `events.attendance.mark`). Добавить seed-скрипт (`access_control/permissions_mvp.py`) и миграции/seed-скрипты, чтобы роли сразу попадали в каталог.
2. **System admin workflow.** Обновить документацию (`documentation/docs/services/access/permissions.md` + `events/roadmap`) и Access API, чтобы системный администратор мог назначать `events.organizer`/`events.participant` через `POST /api/v1/role-bindings` и видеть audit logs. В этом этапе учитываем, что tenant portal UI ещё не готов, поэтому вся настройка происходит под `system_admin=true` (HMAC + Access API).
3. **Tenant portal integration (подготовка).** Спроектировать BFF endpoints (`bff/src/...` или `services/bff`) и REST контракты для списка ролей, создания role bindings и отображения users/roles в портале. Прототип может возвращать `events`-специфичные permissions + `master_flags` (suspended/system_admin) для UI-состояния.
4. **Checks & tests.** Расширить `services/events/tests.py` и добавить integration tests, которые проксируют Access service (можно мокать `access_control.services.compute_effective_access`) и проверяют, что подписчики, `system_admin`, `participant`, `organizer` реально обладают ожидаемыми правами.

## Фаза 2: надёжность и масштаб
1. **Event analytics.** Добавить агрегаты (например, `event.stats`), чтобы `rsvpCounts` можно было кэшировать; рассмотреть Redis/Materialized View.
2. **Event pipeline.** Поднять CDC/queue, чтобы Activity и Portal могли подписываться на `events_outbox` в реальном времени (SSE/BFF push). Подумать об импортировании календарей через ICS.
3. **Monitoring & alerting.** Внедрить Prometheus-экспорт (или push gateway) и alerting по задержкам Outbox.
4. **Operations.** Документировать миграции (`python manage.py migrate events --fake`), эвакуацию `BFF_INTERNAL_HMAC_SECRET`, и автоматический seed `system_admin` через `updspace-id` setup.

## Роли и системный администратор
| Роль | Разрешения | Комментарий |
|------|------------|-------------|
| `events.participant` | `events.event.read`, `events.rsvp.set` | Читает все публичные события (Tenant/Community/Team), может менять RSVP на текущий статус. Назначается пользователю через Access API или portal через master-flags. |
| `events.organizer` | `events.event.create`, `events.event.manage`, `events.attendance.mark` | Создаёт/редактирует события, меняет visibility и отмечает attendance. В текущем этапе изменения разрешены только `system_admin`, но мы планируем tenant portal UI (Phase 1). |

`system_admin=true` остаётся master-флагом из UpdSpaceID, позволяющим обойти Access service, но все операции логируются и проверяется `X-Master-Flags`. Пока tenant portal не умеет редактировать роли напрямую, все создания/обновления происходит через `services/access` с этим флагом, и мигрируется в future phase на обычных администраторов.

## Проверка и тестирование
- `DJANGO_SETTINGS_MODULE=app.settings python3 -m pytest src/events/tests.py` (надо запускать с `PYTHONPATH` так, чтобы `access_control` был доступен — напр. `PYTHONPATH=../access/src:../core/src` при запуске в `services/events`).
- `DJANGO_SETTINGS_MODULE=app.settings python3 -m pytest src/activity/tests.py` (четко проходит, что подтверждает, что Activity feed работает без Access service).
- `PYTHONPATH` должен включать все service-src (`core`, `access_control`), чтобы `require_context`, `core.schemas`, `access_control` доступны.
- Добавить интеграционные тесты с моками `access_control.services.compute_effective_access` и `portal` HTTP клиентом.

## Следующие шаги
1. Обновить Tenant portal UI/Access API, чтобы `system_admin` мог назначать `events`-роли без новых сервисов.
2. Импортировать plan в `documentation/docs/api/overview.md` и `documentation/docs/guides/local-dev.md`, чтобы devs знали, как seedить роли.
3. Постепенно переносить `system_admin` операции в обычные tenant-ролей, когда portal получит нужные endpoints.
4. Наблюдать за Outbox processing и выстроить alerting (Phase 2).
