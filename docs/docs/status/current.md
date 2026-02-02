---
sidebar_position: 1
title: Текущий статус
description: Состояние разработки по сервисам
---

# Текущий статус

Обзор состояния разработки по каждому сервису и фронтенду.

## Легенда

| Статус | Описание |
|--------|----------|
| ✅ Production | Готово к production, протестировано |
| ✅ MVP | Минимально жизнеспособный продукт, работает |
| 🔶 Early MVP | Ранняя стадия, базовый функционал |
| 🚧 In Progress | Активная разработка |
| ⏳ Planned | Запланировано |
| ❌ Not Started | Не начато |

---

## Backend Services

### UpdSpaceID (port 8001)

| Feature | Статус | Notes |
|---------|--------|-------|
| **Core Auth** | | |
| Email/Password login | ✅ Production | |
| Magic Link | ✅ Production | |
| Password reset | ✅ Production | |
| Account activation | ✅ Production | |
| **MFA** | | |
| TOTP setup | ✅ Production | |
| TOTP verification | ✅ Production | |
| Recovery codes | ✅ Production | |
| Backup methods | ⏳ Planned | |
| **Passkeys** | | |
| WebAuthn registration | ✅ Production | |
| WebAuthn authentication | ✅ Production | |
| Cross-platform | ✅ Production | |
| **OAuth/OIDC** | | |
| Authorization Code flow | ✅ Production | |
| Token introspection | ✅ Production | |
| Userinfo endpoint | ✅ Production | |
| PKCE | ⏳ Planned | |
| **Applications** | | |
| App registration | ✅ MVP | |
| Client credentials | ✅ MVP | |
| Scope management | ✅ MVP | |
| **Tenants** | | |
| Tenant creation | ✅ Production | |
| Tenant membership | ✅ Production | |
| Subdomain routing | ✅ Production | |
| **Admin** | | |
| User management | ✅ MVP | |
| Application approval | ✅ MVP | |
| Audit logs | 🔶 Early MVP | |

### BFF (port 8080)

| Feature | Статус | Notes |
|---------|--------|-------|
| Session management | ✅ Production | Redis-backed |
| Cookie auth | ✅ Production | HttpOnly, Secure |
| Proxy routing | ✅ Production | |
| HMAC signing | ✅ Production | X-Request-Signature |
| CSRF protection | ✅ Production | |
| Rate limiting | 🔶 Early MVP | Basic implementation |
| Request validation | ✅ MVP | |

### Access Control (port 8002)

| Feature | Статус | Notes |
|---------|--------|-------|
| Permission check | ✅ Production | |
| Role management | ✅ MVP | |
| Role binding | ✅ MVP | |
| Master flags | ✅ MVP | is_platform_admin, etc. |
| Policy overrides | ✅ MVP | |
| Scope hierarchy | ✅ Production | TENANT > COMMUNITY > TEAM |
| Caching | ✅ MVP | Redis, 5min TTL |

### Portal Core (port 8003)

| Feature | Статус | Notes |
|---------|--------|-------|
| Profiles | ✅ MVP | |
| Communities CRUD | ✅ MVP | |
| Community membership | ✅ MVP | |
| Teams CRUD | ✅ MVP | |
| Team membership | ✅ MVP | |
| Posts CRUD | ✅ MVP | |
| Visibility filtering | ✅ MVP | public/community/team/private |
| Modules navigation | ✅ Production | |

### Voting (port 8004)

| Feature | Статус | Notes |
|---------|--------|-------|
| Polls CRUD | ✅ MVP | |
| Nominations | ✅ MVP | |
| Options | ✅ MVP | |
| Vote casting | ✅ MVP | Anti-duplicate |
| Results | ✅ MVP | |
| Visibility | ✅ MVP | |
| Outbox events | ✅ Production | vote.cast |
| Legacy migration | ✅ Done | aef-vote → tenant_voting |

### Events (port 8005)

| Feature | Статус | Notes |
|---------|--------|-------|
| Events CRUD | ✅ MVP | |
| RSVP | ✅ MVP | interested/going/not_going |
| Attendance | ✅ MVP | |
| Visibility | ✅ MVP | |
| Calendar view | ✅ MVP | |
| Outbox events | ✅ MVP | event.created, rsvp.changed |
| Recurring events | ⏳ Planned | |

### Activity (port 8006)

| Feature | Статус | Notes |
|---------|--------|-------|
| Activity feed | ✅ MVP | |
| Games catalog | ✅ MVP | |
| Sources | ✅ MVP | |
| Account links | ✅ MVP | |
| Steam connector | 🔶 Early MVP | Mock API in dev |
| Minecraft connector | ✅ MVP | Webhook |
| Discord connector | ⏳ Planned | |
| Subscriptions | ✅ MVP | |
| Webhook ingest | ✅ MVP | |
| Internal events | ✅ MVP | From other services |

---

## Frontend

### Portal Frontend

| Feature | Статус | Notes |
|---------|--------|-------|
| Voting module | ✅ Production | |
| Events module | ✅ MVP | |
| Feed module | ✅ MVP | |
| Profile page | ✅ MVP | |
| Communities | 🔶 Early MVP | |
| Dark mode | ✅ Production | |
| Responsive design | ✅ MVP | |
| Offline support | ⏳ Planned | PWA |

### ID Frontend

| Feature | Статус | Notes |
|---------|--------|-------|
| Login page | ✅ Production | |
| Magic Link | ✅ Production | |
| MFA setup | ✅ Production | |
| MFA verification | ✅ Production | |
| Passkey setup | ✅ Production | |
| Passkey login | ✅ Production | |
| OAuth authorize | ✅ Production | |
| Profile management | ✅ MVP | |
| Security settings | ✅ MVP | |
| Sessions management | ✅ MVP | |
| Password reset | ✅ Production | |
| Account activation | ✅ Production | |

---

## Infrastructure

| Component | Статус | Notes |
|-----------|--------|-------|
| Docker Compose | ✅ Production | Dev environment |
| Traefik | ✅ Production | Reverse proxy |
| PostgreSQL | ✅ Production | Per-service DBs |
| Redis | ✅ Production | Sessions, cache |
| Kubernetes | ⏳ Planned | For production |
| CI/CD | 🔶 Early MVP | GitHub Actions |
| Monitoring | ⏳ Planned | Prometheus + Grafana |
| Logging | 🔶 Early MVP | Basic logs |
