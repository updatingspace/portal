---
title: BFF Routing
---

# BFF Routing

BFF обслуживает смесь собственных endpoints и прозрачных proxy paths.

## High-level route groups

| Route group | Purpose |
| --- | --- |
| `/session/*` | browser session introspection, tenant switching, logout, callback completion |
| `/entry/*` | entry bootstrap and tenant application flows |
| `/auth/*` | login, callback, headless auth proxying |
| `/access/*` | proxy to Access service |
| `/portal/*` | proxy to Portal service |
| `/votings`, `/nominations`, `/polls`, `/votes` | proxy to Voting service |
| `/events/*` | proxy to Events service |
| `/activity` and feed/account paths | proxy to Activity |
| `/gamification/*` | proxy to Gamification |
| `/account/*` | proxy to identity/account-related surface |

## Internal context forwarded downstream

Для доверенных upstream calls BFF добавляет:

- `X-Request-Id`
- `X-Tenant-Id`
- `X-Tenant-Slug`
- `X-User-Id`
- `X-Master-Flags`
- HMAC подпись и timestamp
- trusted `X-Forwarded-Proto`

## Why routing is not a thin reverse proxy

BFF делает больше, чем простая прокладка:

- переводит browser auth в internal auth context;
- унифицирует ошибки;
- знает про tenantless state;
- умеет materialize session на auth success;
- частично агрегирует bootstrap response.

## Routing design rules

- если downstream endpoint требует user context, BFF не должен пропускать его как anonymous proxy;
- если route меняет browser session, он живет в BFF, а не в доменном сервисе;
- если route нужен только internal mesh, он не должен открываться браузеру напрямую.
