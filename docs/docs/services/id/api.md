---
sidebar_position: 3
title: API Endpoints
description: REST API UpdSpaceID
---

# API UpdSpaceID

Base URL: `http://id.localhost/api/v1` (dev) / `https://id.updspace.com/api/v1` (prod)

## Applications

### Create Application

```http
POST /applications
Content-Type: application/json

{
  "tenant_slug": "aef",
  "email": "user@example.com",
  "payload": {
    "name": "Иван Иванов",
    "motivation": "Хочу участвовать в голосованиях",
    "referral": "Пригласил друг"
  }
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "status": "pending",
  "created_at": "2026-01-14T12:00:00Z"
}
```

### List Applications (Admin)

```http
GET /applications?status=pending
Authorization: Bearer {admin_token}
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "payload": {...},
      "status": "pending",
      "created_at": "2026-01-14T12:00:00Z"
    }
  ],
  "total": 1
}
```

### Approve Application (Admin)

```http
POST /applications/{id}/approve
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "note": "Всё в порядке"
}
```

**Response 200:**
```json
{
  "user_id": "uuid",
  "activation_link_sent": true
}
```

### Reject Application (Admin)

```http
POST /applications/{id}/reject
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "reason": "Неполная заявка"
}
```

## Authentication

### Activate Account

```http
POST /auth/activate
Content-Type: application/json

{
  "token": "activation_token_from_email"
}
```

**Response 200:**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "activated": true
}
```

**Error 400 (TOKEN_USED):**
```json
{
  "error": {
    "code": "TOKEN_USED",
    "message": "This activation token has already been used"
  }
}
```

### Request Magic Link

```http
POST /auth/magic-link/request
Content-Type: application/json

{
  "email": "user@example.com",
  "redirect_to": "https://aef.updspace.com/api/v1/auth/callback"
}
```

**Response 200:**
```json
{
  "sent": true
}
```

**Dev mode response:**
```json
{
  "sent": true,
  "dev_magic_link": "http://id.localhost/auth/magic-link/consume?token=xxx"
}
```

### Consume Magic Link

```http
GET /auth/magic-link/consume?token=xxx
```

**Response 302:** Redirect to BFF callback with `code` parameter.

Для API-потребителей доступен POST:

```http
POST /auth/magic-link/consume
Content-Type: application/json

{
  "token": "xxx"
}
```

**Response 200:**
```json
{
  "ok": true,
  "user_id": "uuid",
  "session_token": "token"
}
```

### Logout

```http
POST /auth/logout
Cookie: session_id=xxx
```

**Response 200:**
```json
{
  "logged_out": true
}
```

## User Info

### Get Current User

```http
GET /me
Cookie: session_id=xxx
```

**Response 200:**
```json
{
  "user_id": "uuid",
  "username": "ivan",
  "email": "ivan@example.com",
  "email_verified": true,
  "display_name": "Иван Иванов",
  "status": "active",
  "system_admin": false,
  "memberships": [
    {
      "tenant_id": "uuid",
      "tenant_slug": "aef",
      "status": "active",
      "base_role": "member"
    }
  ],
  "master_flags": {
    "suspended": false,
    "banned": false,
    "system_admin": false,
    "email_verified": true
  }
}
```

## External Identity

### Start Linking

```http
POST /external-identities/{provider}/link/start
Cookie: session_id=xxx
Content-Type: application/json

{
  "redirect_uri": "https://aef.updspace.com/settings"
}
```

**Response 200:**
```json
{
  "authorization_url": "https://github.com/login/oauth/authorize?...",
  "state": "oauth_state",
  "nonce": "oauth_nonce"
}
```

### Link Callback

```http
POST /external-identities/{provider}/link/callback
Cookie: session_id=xxx
Content-Type: application/json

{
  "code": "oauth_code",
  "state": "oauth_state",
  "openid_params": {
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.claimed_id": "https://steamcommunity.com/openid/id/7656...",
    "openid.identity": "https://steamcommunity.com/openid/id/7656...",
    "openid.return_to": "https://aef.updspace.com/settings?state=oauth_state",
    "openid.response_nonce": "...",
    "openid.assoc_handle": "...",
    "openid.signed": "...",
    "openid.sig": "..."
  }
}
```

`code` обязателен для GitHub/Discord. Для Steam передайте `openid_params`
или `claimed_id` из OpenID callback.

**Response 200:**
```json
{
  "ok": true
}
```

## OAuth Login (Already Linked)

### Start OAuth Login

```http
POST /oauth/{provider}/login/start
Content-Type: application/json

{
  "redirect_uri": "https://aef.updspace.com/"
}
```

**Response 200:**
```json
{
  "authorization_url": "https://github.com/login/oauth/authorize?...",
  "state": "oauth_state",
  "nonce": "oauth_nonce"
}
```

### OAuth Login Callback

```http
POST /oauth/{provider}/login/callback
Content-Type: application/json

{
  "code": "oauth_code",
  "state": "oauth_state"
}
```

`code` обязателен для GitHub/Discord. Для Steam передайте `openid_params`
или `claimed_id` из OpenID callback.

**Response 200 (if linked):**
```json
{
  "ok": true,
  "user_id": "uuid",
  "session_token": "session_token"
}
```

**Error 403 (not linked):**
```json
{
  "error": {
    "code": "ACCOUNT_NOT_LINKED",
    "message": "No account is linked to this GitHub identity. Please login and link first."
  }
}
```

## Preferences & Timezone

### Get Preferences

```http
GET /auth/preferences
X-Session-Token: {session_token}
```

**Response 200:**
```json
{
  "language": "ru",
  "timezone": "Europe/Moscow",
  "marketing_opt_in": false,
  "privacy_scope_defaults": {
    "profile_basic": "allow",
    "email": "ask",
    "phone": "ask"
  }
}
```

### Update Preferences

```http
PATCH /auth/preferences
X-Session-Token: {session_token}
Content-Type: application/json

{
  "language": "en",
  "timezone": "America/New_York",
  "marketing_opt_in": true,
  "privacy_scope_defaults": {
    "profile_basic": "allow",
    "email": "allow"
  }
}
```

**Response 200:**
```json
{
  "language": "en",
  "timezone": "America/New_York",
  "marketing_opt_in": true,
  "privacy_scope_defaults": {...}
}
```

### Get Available Timezones

```http
GET /auth/timezones
```

**Public endpoint** — не требует аутентификации.

**Response 200:**
```json
{
  "timezones": [
    {
      "name": "Europe/Moscow",
      "display_name": "Europe/Moscow (UTC+03:00)",
      "offset": "+03:00"
    },
    {
      "name": "America/New_York",
      "display_name": "America/New_York (UTC-05:00)",
      "offset": "-05:00"
    },
    ...
  ]
}
```

:::info Timezone Management
- При регистрации timezone автоматически определяется из браузера (`Intl.DateTimeFormat().resolvedOptions().timeZone`)
- Список timezone основан на `pytz.common_timezones` (IANA Time Zone Database)
- Timezone валидируется на backend при сохранении
- Пользователь может изменить timezone в настройках профиля (`id.localhost/account`)
:::

## Migration

### Import Users (Admin)

```http
POST /migrations/aefvote/import
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "users": [
    {
      "old_id": "legacy_user_123",
      "email": "user@example.com",
      "username": "olduser",
      "display_name": "Old User"
    }
  ],
  "tenant_slug": "aef"
}
```

**Response 200:**
```json
{
  "imported": 1,
  "skipped": 0,
  "errors": []
}
```

### Generate Claim Token (Admin)

```http
POST /migrations/aefvote/claim-token/{user_id}
Authorization: Bearer {admin_token}
```

**Response 200:**
```json
{
  "activation_token": "xxx",
  "expires_at": "2026-01-21T12:00:00Z"
}
```

## OIDC Endpoints

See [OIDC documentation](./oauth-providers) for:
- `GET /oauth/authorize`
- `POST /oauth/token`
- `GET /oauth/userinfo`
- `GET /.well-known/openid-configuration`
- `GET /.well-known/jwks.json`
- `GET /oauth/jwks`

The JWKS response lists every configured key pair (active and retired). Each token carries a `kid` header so token validation keeps working while you rotate keys. The `OIDC_JWKS_URI` environment variable controls the discovery URI (defaults to `https://id.updspace.com/.well-known/jwks.json`).

New token issuance or refresh attempts abort with `ACCOUNT_SUSPENDED` / `ACCOUNT_BANNED` if the UpdSpace master flags show that the linked account is blocked. Refresh calls check status in real time before handing out a new refresh/ access token.

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `APPLICATION_NOT_FOUND` | 404 | Заявка не найдена |
| `APPLICATION_ALREADY_PROCESSED` | 409 | Заявка уже обработана |
| `TOKEN_EXPIRED` | 400 | Токен истёк |
| `TOKEN_USED` | 400 | Токен уже использован |
| `TOKEN_NOT_FOUND` | 404 | Токен не найден |
| `ACCOUNT_NOT_LINKED` | 403 | OAuth аккаунт не привязан |
| `ACCOUNT_SUSPENDED` | 403 | Аккаунт заблокирован |
| `EMAIL_NOT_VERIFIED` | 403 | Email не подтверждён |
| `RATE_LIMITED` | 429 | Слишком много запросов |
