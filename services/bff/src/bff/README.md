# UpdSpace BFF (AEF portal)

## Entry point

All frontend calls go through:

- `/api/v1/*`

## Tenant resolution

- Tenant is resolved from `Host` (subdomain): `aef.updspace.com` → `tenant_slug=aef`
- BFF maps `tenant_slug` → `tenant_id` (DB `bff_tenant`)
- For internal requests BFF adds:
  - `X-Tenant-Id`
  - `X-Tenant-Slug`

## Session

- Cookie: HttpOnly session cookie (default `updspace_session`)
- Stored as: `session_id -> tenant_id, user_id, master_flags, expires_at`
- Primary: Django cache (configure Redis backend for production)
- Optional fallback: Postgres (`BFF_SESSION_DB_FALLBACK=1`)

## BFF endpoints

- `GET /api/v1/session/me` → aggregates `user + portal_profile`
- `POST /api/v1/session/logout`
- `POST /api/v1/internal/session/establish` (server-to-server from UpdSpaceID; sets HttpOnly cookie)
- Proxy (adds context + signature):
  - `/api/v1/portal/*` → Portal Core
  - `/api/v1/voting/*` → Voting
  - `/api/v1/events/*` → Events
  - `/api/v1/feed/*` → Activity

## Context headers

- `X-Request-Id` (generated if missing)
- `X-Tenant-Id`, `X-Tenant-Slug`
- `X-User-Id`
- `X-Master-Flags` (JSON)

## Request signing (internal)

- `X-Updspace-Timestamp`
- `X-Updspace-Signature` (HMAC-SHA256)

Signature input:

```text
METHOD\nPATH\nSHA256(body)\nREQUEST_ID\nTIMESTAMP
```

## Security

- CORS should allow only `*.updspace.com` (default via `CORS_ALLOWED_ORIGIN_REGEXES`)
- CSRF for cookie-auth API: double-submit token (`updspace_csrf` cookie + `X-CSRF-Token` header)
- Rate limit: `/api/v1/session/*`

## Settings

- `BFF_TENANT_HOST_SUFFIX` (default `updspace.com`)
- `BFF_COOKIE_DOMAIN` (recommended `.updspace.com`)
- `BFF_INTERNAL_HMAC_SECRET` (required for proxy signing)
- `BFF_UPDSPACEID_CALLBACK_SECRET` (required for `/internal/session/establish`)
- `BFF_UPSTREAM_PORTAL_URL`, `BFF_UPSTREAM_VOTING_URL`, `BFF_UPSTREAM_EVENTS_URL`, `BFF_UPSTREAM_FEED_URL`
- `BFF_SESSION_DB_FALLBACK` (default 0)
- `BFF_SESSION_RATE_LIMIT_PER_MIN` (default 60)
