---
sidebar_position: 1
title: API Overview
description: Обзор всех API endpoints
---

# API Reference

Все API endpoints по сервисам.

## Общие правила

### Base URLs

| Service | Internal URL | BFF Proxy |
|---------|--------------|-----------|
| UpdSpaceID | `http://id:8001` | `/api/bff/auth/*` |
| Portal | `http://portal:8003` | `/api/bff/portal/*` |
| Voting | `http://voting:8004` | `/api/bff/voting/*` |
| Events | `http://events:8005` | `/api/bff/events/*` |
| Activity | `http://activity:8006` | `/api/bff/activity/*` |
| Access | `http://access:8002` | (internal only) |

### Authentication

**Frontend → BFF:**
```
Cookie: session=xxx; csrf_token=xxx
X-CSRF-Token: xxx
```

**BFF → Services:**
```
X-User-ID: uuid
X-Tenant-ID: uuid
X-Request-Timestamp: 1705234567
X-Request-Signature: hmac-sha256-xxx
```

### Error Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

Common error codes:
- `UNAUTHORIZED` — 401
- `FORBIDDEN` — 403
- `NOT_FOUND` — 404
- `VALIDATION_ERROR` — 422
- `CONFLICT` — 409 (e.g., ALREADY_VOTED)
- `RATE_LIMITED` — 429
- `INTERNAL_ERROR` — 500

---

## UpdSpaceID API

### Auth

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secret"
}
```

Response:
```json
{
  "requires_mfa": false,
  "redirect_uri": "https://aef.updspace.com/"
}
```

```http
POST /api/auth/magic-link
Content-Type: application/json

{
  "email": "user@example.com",
  "redirect_uri": "https://aef.updspace.com/"
}
```

```http
GET /api/auth/magic-link/verify?token=xxx
```

### MFA

```http
POST /api/mfa/setup/totp
```

Response:
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "otpauth_uri": "otpauth://totp/UpdSpace:user@example.com?secret=..."
}
```

```http
POST /api/mfa/setup/totp/verify
Content-Type: application/json

{
  "code": "123456"
}
```

```http
POST /api/mfa/verify
Content-Type: application/json

{
  "code": "123456"
}
```

### Passkeys

```http
POST /api/passkeys/register/begin
```

```http
POST /api/passkeys/register/complete
Content-Type: application/json

{
  "credential": "base64-encoded-credential"
}
```

```http
POST /api/passkeys/authenticate/begin
Content-Type: application/json

{
  "email": "user@example.com"
}
```

```http
POST /api/passkeys/authenticate/complete
Content-Type: application/json

{
  "credential": "base64-encoded-credential"
}
```

### OAuth

```http
GET /api/oauth/authorize?client_id=xxx&redirect_uri=xxx&scope=xxx&state=xxx
```

```http
POST /api/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=xxx&redirect_uri=xxx&client_id=xxx&client_secret=xxx
```

```http
POST /api/oauth/token/introspect
Content-Type: application/x-www-form-urlencoded

token=xxx
```

```http
GET /api/oauth/userinfo
Authorization: Bearer xxx
```

---

## Portal API

### Profile

```http
GET /api/v1/me
```

```http
PATCH /api/v1/me
Content-Type: application/json

{
  "first_name": "Ivan",
  "last_name": "Ivanov",
  "bio": "About me"
}
```

### Communities

```http
GET /api/v1/communities
```

```http
GET /api/v1/communities/{id}
```

```http
POST /api/v1/communities
Content-Type: application/json

{
  "name": "Community Name",
  "description": "Description"
}
```

### Teams

```http
GET /api/v1/teams?community_id=xxx
```

```http
POST /api/v1/teams
Content-Type: application/json

{
  "community_id": "uuid",
  "name": "Team Name"
}
```

### Posts

```http
GET /api/v1/posts?scope_type=community&scope_id=xxx
```

```http
POST /api/v1/posts
Content-Type: application/json

{
  "title": "Post Title",
  "body": "Post content",
  "visibility": "community",
  "community_id": "uuid"
}
```

---

## Voting API

### Polls

```http
GET /api/v1/polls?scope_type=TENANT&status=active
```

```http
GET /api/v1/polls/{poll_id}
```

### Votes

```http
POST /api/v1/votes
Content-Type: application/json

{
  "poll_id": "uuid",
  "nomination_id": "uuid",
  "option_id": "uuid"
}
```

### Results

```http
GET /api/v1/polls/{poll_id}/results
```

---

## Events API

### Events

```http
GET /api/v1/events?from=2026-01-01&to=2026-01-31&scope_type=COMMUNITY&scope_id=uuid&limit=50&offset=0
```

Response:

```json
{
  "items": [{ "id": "...", "title": "Game Night", "rsvpCounts": {...}, "myRsvp": "going" }],
  "meta": { "total": 1, "limit": 50, "offset": 0 }
}
```

```http
GET /api/v1/events/{event_id}
```

```http
POST /api/v1/events
Content-Type: application/json

{
  "title": "Game Night",
  "starts_at": "2026-01-15T19:00:00Z",
  "ends_at": "2026-01-15T22:00:00Z",
  "scope_type": "COMMUNITY",
  "scope_id": "uuid"
}
```

```http
PATCH /api/v1/events/{event_id}
Content-Type: application/json

{
  "title": "Game Night – Afterparty",
  "visibility": "community"
}
```

`PATCH` требует permission `events.event.manage` (или `system_admin=true`).

### RSVP

```http
POST /api/v1/events/{event_id}/rsvp
Content-Type: application/json

{
  "status": "going"
}
```

---

## Activity API

### Feed

```http
GET /api/v1/feed?from=2026-01-01&to=2026-01-31&types=vote.*,event.*
```

### Games

```http
GET /api/v1/games
```

### Account Links

```http
POST /api/v1/account-links
Content-Type: application/json

{
  "source_id": "uuid",
  "settings": {
    "steam_id": "76561198012345678"
  }
}
```

### Webhooks

```http
POST /api/v1/ingest/webhook/{source_type}
X-Webhook-Signature: sha256=xxx
X-Webhook-Timestamp: 1705234567
Content-Type: application/json

{
  "type": "event_type",
  "data": {}
}
```

---

## Access Control API

:::note
Access Control API — internal only, not exposed via BFF.
:::

```http
GET /api/v1/check?user_id=xxx&tenant_id=xxx&permission=xxx&scope_type=xxx&scope_id=xxx
```

```http
GET /api/v1/roles?tenant_id=xxx
```

```http
POST /api/v1/role-bindings
Content-Type: application/json

{
  "tenant_id": "uuid",
  "user_id": "uuid",
  "role_id": "uuid",
  "scope_type": "COMMUNITY",
  "scope_id": "uuid"
}
```
