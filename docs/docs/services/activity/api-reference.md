---
title: API Surface
---

# API Surface

Ниже не полный OpenAPI dump, а инженерная карта endpoint families.

## Feed

- `GET /feed`
- `GET /feed/unread-count`
- `GET /feed/unread-count/long-poll`
- SSE endpoint вынесен из Ninja router в `app/urls.py`

## News

- `POST /news/media/upload-url`
- `POST /news`
- `GET /news/{id}`
- `PATCH /news/{id}`
- `DELETE /news/{id}`
- comments and reactions endpoints

## Connectors and account links

- `GET /games`
- `GET /sources`
- `POST /account-links`
- `DELETE /account-links/{id}`
- sync-related endpoints

## Integrations

- `POST /integrations/minecraft/webhook`

## Operational surfaces

- `/health`
- `/readiness`
- `/metrics`
- `/api/v1/feed/sse`

## Practical note

Если нужен точный schema contract, берите OpenAPI из runtime и сверяйте с `activity/schemas.py`. Этот раздел нужен для ориентации, а не для byte-perfect contract copy.
