---
sidebar_position: 1
title: Обзор Gamification
description: Сервис ачивок и выдач
---

# Gamification Service

**Gamification** — сервис ачивок и их выдач (grants), включая статусы, категории и историю выдач.

- **Path**: `services/gamification`
- **Port**: 8007

## Функционал

| Feature | Статус | Описание |
|---------|--------|----------|
| Achievements CRUD | ✅ MVP | Создание/редактирование/публикация/скрытие |
| Categories | ✅ MVP | Управляемые категории (multi-tenant) |
| Grants | ✅ MVP | Выдача и отзыв ачивок |
| Private visibility | ✅ MVP | Draft/hidden и private grants |
| Outbox events | ✅ MVP | `gamification.grant.created`, `gamification.grant.revoked` |

## Основные эндпоинты (BFF)

- `GET /api/v1/gamification/achievements`
- `POST /api/v1/gamification/achievements`
- `PATCH /api/v1/gamification/achievements/{id}`
- `GET /api/v1/gamification/achievements/{id}/grants`
- `POST /api/v1/gamification/achievements/{id}/grants`
- `POST /api/v1/gamification/grants/{grant_id}/revoke`
- `GET /api/v1/gamification/categories`
- `POST /api/v1/gamification/categories`
- `PATCH /api/v1/gamification/categories/{id}`

## RBAC

Права доступа задаются через Access service:

- `gamification.achievements.create`
- `gamification.achievements.edit`
- `gamification.achievements.publish`
- `gamification.achievements.hide`
- `gamification.achievements.assign`
- `gamification.achievements.revoke`
- `gamification.achievements.view_private`

## Outbox

При выдаче/отзыве ачивок создаются события:

- `gamification.grant.created`
- `gamification.grant.revoked`
