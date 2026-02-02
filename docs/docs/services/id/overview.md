---
sidebar_position: 1
title: Обзор UpdSpaceID
description: Identity Provider для всех tenant'ов
---

# UpdSpaceID

**UpdSpaceID** — централизованный Identity Provider для всей платформы UpdSpace.

- **Path**: `services/id`
- **Port**: 8001
- **URL**: `id.updspace.com` (prod) / `id.localhost` (dev)

## Статус реализации

| Функционал | Статус | Примечания |
|------------|--------|------------|
| Applications (заявки) | ✅ Done | CRUD + approve/reject |
| Activation (claim) | ✅ Done | One-time token |
| Magic Link login | ✅ Done | Email-based auth |
| OIDC Provider | ✅ Done | Full OAuth2/OIDC flow |
| MFA (TOTP) | ✅ Done | via allauth |
| Passkeys/WebAuthn | ✅ Done | via allauth |
| OAuth Providers | ✅ Production | GitHub/Discord/Steam linking |
| Migration AefVote | ✅ Done | Import + claim tokens |
| Master Rules | ✅ Done | suspended/banned/system_admin |

## Ключевые концепции

### 1. Нет Self-Signup

```
Пользователь → Application → Admin Approve → Activation Link → Active User
```

### 2. OAuth НЕ создаёт аккаунт

OAuth providers (GitHub, Discord, Steam) могут только:
- **Linking**: Привязать к существующему аккаунту
- **Login**: Войти, если уже привязан

Попытка OAuth login без привязки → `ACCOUNT_NOT_LINKED` error.

### 3. Master Rules

UpdSpaceID хранит глобальные флаги, которые имеют высший приоритет:

| Flag | Эффект |
|------|--------|
| `suspended` | Deny all access |
| `banned` | Deny all access (permanent) |
| `system_admin` | Allow all (with audit) |
| `email_verified` | Required for most actions |

### 4. MFA flow (TOTP)

- `POST /auth/mfa/totp/begin` теперь сохраняет секрет в сессии и не включает MFA.
- `POST /auth/mfa/totp/confirm` активирует TOTP только если в сессии есть секрет и код валиден; при отсутствии секрета возвращает `TOTP_SETUP_REQUIRED`.
- После успешной активации секрет удаляется из сессии, выдаются recovery-коды.
- `POST /auth/mfa/recovery/regenerate` требует активной MFA и возвращает `MFA_REQUIRED`, если факторов нет.

## Модули

### `accounts/`
Профили пользователей (Django User + allauth):
- UserProfile (avatar, phone, birthday)
- UserPreferences (language, timezone — автоматически определяется из браузера при регистрации)
- Consents (GDPR)
- DeviceSessions, LoginHistory, AuditLog

:::tip Timezone автоопределение
При регистрации timezone автоматически определяется из браузера через `Intl.DateTimeFormat().resolvedOptions().timeZone`. Пользователь не видит это поле при регистрации, но может изменить его позже в настройках профиля. Backend валидирует timezone используя библиотеку `pytz` (IANA Time Zone Database).
:::

### `idp/`
OIDC Provider:
- OIDCClient (registered applications)
- AuthorizationRequest, AuthorizationCode
- TokenGrant, UserConsent

### `updspaceid/`
Core identity management:
- Tenant, UpdSpaceUser
- TenantMembership
- Application, ActivationToken, MagicLinkToken
- ExternalIdentity, OAuthState
- Session, AuditLog, OutboxEvent, MigrationMap

## Диаграмма потока

```mermaid
sequenceDiagram
    participant User
    participant Portal
    participant ID
    participant Email

    Note over User,Email: Application Flow
    User->>Portal: Заявка на регистрацию
    Portal->>ID: POST /applications
    ID->>ID: Save Application(pending)
    
    Note over User,Email: Approve Flow
    Admin->>ID: POST /applications/{id}/approve
    ID->>ID: Create User + Membership
    ID->>Email: Send activation link
    
    Note over User,Email: Activation
    User->>ID: GET /activate?token=xxx
    ID->>ID: Validate & activate
    
    Note over User,Email: Login
    User->>Portal: Click Login
    Portal->>ID: OIDC authorize
    ID->>Email: Send magic link (or show form)
    User->>ID: Authenticate
    ID->>Portal: Redirect with code
    Portal->>ID: Exchange code → tokens
```

## Интеграции

### С BFF
- OIDC authorize/token/userinfo
- Magic link request/consume
- Session creation callback

### С Access Service
- Не напрямую, но master_flags передаются через BFF в Access

## Конфигурация

```bash
# Environment variables
SECRET_KEY=django-secret-key
DATABASE_URL=postgres://user:pass@db_id:5432/updspaceid
REDIS_URL=redis://redis:6379/0

# OIDC
OIDC_ISSUER=https://id.updspace.com
OIDC_PUBLIC_BASE_URL=https://id.updspace.com/api/v1
OIDC_PRIVATE_KEY_PEM="@/secrets/oidc_private.pem"
OIDC_PUBLIC_KEY_PEM="@/secrets/oidc_public.pem"
# Optional key rotation: JSON array of key pairs (active=latest, include retired keys for JWKS)
OIDC_KEY_PAIRS='[
  {
    "kid": "current",
    "private_key_pem": "-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----",
    "public_key_pem": "-----BEGIN PUBLIC KEY-----...-----END PUBLIC KEY-----",
    "active": true
  },
  {
    "kid": "legacy",
    "private_key_pem": "...",
    "public_key_pem": "...",
    "active": false
  }
]'
OIDC_JWKS_URI=https://id.updspace.com/.well-known/jwks.json

# OAuth providers
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GITHUB_REDIRECT_URIS=https://aef.updspace.com/settings
DISCORD_CLIENT_ID=xxx
DISCORD_CLIENT_SECRET=xxx
DISCORD_REDIRECT_URIS=https://aef.updspace.com/settings
STEAM_API_KEY=xxx
STEAM_REDIRECT_URIS=https://aef.updspace.com/settings

# Email
EMAIL_HOST=smtp.example.com
DEFAULT_FROM_EMAIL=no-reply@updspace.com
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend  # dev: console backend avoids external SMTP

# Public URLs
ID_PUBLIC_BASE_URL=https://id.updspace.com/api/v1
ID_ACTIVATION_BASE_URL=https://id.updspace.com
ID_ACTIVATION_PATH=/activate
MAGIC_LINK_DEFAULT_REDIRECT=https://aef.updspace.com/api/v1/session/callback
ID_TOKEN_HASH_SECRET=change-me

# Dev mode
DEV_AUTH_MODE=true  # Skip email, return magic link directly
```

## Local admin bootstrap (dev)

Для локальной разработки первичного `system_admin` создаём через команду,
которая печатает magic link в консоль:

```bash
docker compose -f infra/docker-compose/docker-compose.dev.yml exec updspaceid \
  python src/manage.py issue_admin_magic_link --email dev@aef.local
```

Команда создаёт/обновляет пользователя, привязывает к tenant и выводит magic link.
Откройте ссылку в браузере — будет создана BFF-сессия для `aef.localhost`.

## User identifiers

- Все пользовательские идентификаторы (`user_id`, `X-User-Id`, `sub`, `leaderboard_user_id` и т.п.) в нашей системе — это UUID. Мы не выдаём последовательные счётчики, чтобы не раскрывать число зарегистрированных аккаунтов и чтобы upstream-сервисы (events/voting/activity/etc.) всегда получали строки длины 36 с соответствующим форматом.
- При интеграции с BFF, ID или другими сервисами обязательно передавайте `X-User-Id` как UUID; если приходит "counter" или обычный инкрементальный ID, запрос должен отвергаться (см. `INVALID_USER_ID` в логах).
