---
title: Guilds & Unions (Concept)
---

# Гильдии и объединения внутри tenant‑комьюнити

## 1. Цели

1. Дать игрокам возможность создавать **гильдии/объединения** внутри каждого tenant.
2. У каждой гильдии есть **страница**, **участники**, **роли** и **RBAC‑права**.
3. Возможность публиковать новости, события, рекрутинг, расписания.
4. Интеграция в Activity Feed и будущие сервисы (Events/Voting/Portal).

## 2. Ключевые принципы

- **Multi‑tenant**: каждая таблица содержит `tenant_id`.
- **RBAC через Access Service**: разрешения проверяются по `scope_type = GUILD`, `scope_id = guild_id`.
- **BFF mandatory**: весь frontend идет через BFF.
- **Outbox pattern** для кросс‑сервисных событий.

## 3. Архитектура

### Новый микросервис: `Guilds`

**Service name**: `guilds`  
**Port**: 8007  
**API**: Django + Ninja  
**Database**: PostgreSQL  
**BFF**: `/guilds/*` → `guilds` upstream  

### Компоненты

- `Guild` — базовая сущность гильдии.
- `GuildMember` — участник гильдии.
- `GuildRole` — роль внутри гильдии.
- `GuildPermission` — набор permissions для роли.
- `GuildPage` — публичная страница гильдии.
- `GuildInvite` — приглашения в гильдию.
- `GuildOutbox` — outbox событий (для Activity/Notifications).

## 4. Модель данных (предложение)

### Guild

| Field | Type | Notes |
|------|------|------|
| id | UUID | PK |
| tenant_id | UUID | обязательный |
| community_id | UUID | привязка к community |
| name | string | уникальность в рамках community |
| slug | string | URL slug |
| description | text | optional |
| visibility | enum | public / community / private |
| created_by | UUID | user_id |
| created_at | datetime | |
| updated_at | datetime | |

### GuildPage

| Field | Type | Notes |
|------|------|------|
| id | UUID | PK |
| tenant_id | UUID | |
| guild_id | UUID | FK |
| headline | string | |
| body | text | markdown |
| tags | json | массив тегов |
| media | json | ссылки/картинки |
| updated_by | UUID | |
| updated_at | datetime | |

### GuildMember

| Field | Type | Notes |
|------|------|------|
| id | UUID | PK |
| tenant_id | UUID | |
| guild_id | UUID | FK |
| user_id | UUID | |
| role_id | UUID | FK |
| joined_at | datetime | |
| status | enum | active / banned / pending |

### GuildRole

| Field | Type | Notes |
|------|------|------|
| id | UUID | PK |
| tenant_id | UUID | |
| guild_id | UUID | FK |
| name | string | |
| is_system | bool | owner/officer/member |
| created_at | datetime | |

### GuildPermission

| Field | Type | Notes |
|------|------|------|
| id | UUID | PK |
| tenant_id | UUID | |
| guild_id | UUID | FK |
| role_id | UUID | FK |
| permission_key | string | `guild.page.edit` etc |

### GuildInvite

| Field | Type | Notes |
|------|------|------|
| id | UUID | PK |
| tenant_id | UUID | |
| guild_id | UUID | FK |
| code | string | публичный invite код |
| created_by | UUID | |
| expires_at | datetime | |
| max_uses | int | |
| uses | int | |

## 5. RBAC и permissions

**Scope**: `GUILD`  
**Keys** (предложение):

- `guild.read`
- `guild.create`
- `guild.manage`
- `guild.members.read`
- `guild.members.invite`
- `guild.members.kick`
- `guild.roles.manage`
- `guild.page.read`
- `guild.page.edit`
- `guild.news.create`

**Роли**:

- `owner`: полный доступ
- `officer`: управление участниками и страницей
- `member`: базовый доступ

## 6. API (предложение)

### Guilds

- `GET /guilds` — список гильдий (tenant/community)
- `POST /guilds` — создать гильдию
- `GET /guilds/{id}` — детали
- `PATCH /guilds/{id}` — обновить
- `DELETE /guilds/{id}` — архивировать

### Members

- `GET /guilds/{id}/members`
- `POST /guilds/{id}/members`
- `DELETE /guilds/{id}/members/{user_id}`

### Roles & Permissions

- `GET /guilds/{id}/roles`
- `POST /guilds/{id}/roles`
- `PATCH /guilds/{id}/roles/{role_id}`
- `POST /guilds/{id}/roles/{role_id}/permissions`

### Page

- `GET /guilds/{id}/page`
- `PUT /guilds/{id}/page`

### Invites

- `POST /guilds/{id}/invites`
- `GET /guilds/{id}/invites`
- `POST /guilds/invites/{code}/accept`

## 7. Взаимодействие с Activity

Outbox события:

- `guild.created`
- `guild.updated`
- `guild.member.joined`
- `guild.member.left`

