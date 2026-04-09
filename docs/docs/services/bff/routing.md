---
sidebar_position: 2
title: Routing
description: Маршрутизация запросов в BFF
---

# BFF Routing

## Локальные endpoints

BFF обрабатывает напрямую (не проксирует):

### Session Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/csrf` | Bootstrap Django CSRF cookie/token for SPA |
| GET | `/api/v1/session/me` | Текущая сессия + профиль |
| GET | `/api/v1/account/me/export` | Self-service DSAR export aggregator |
| DELETE | `/api/v1/account/me` | Self-service erase + account deletion orchestration |
| POST | `/api/v1/session/logout` | Выход |
| POST | `/api/v1/session/login` | Magic link login (legacy) |

### OIDC Authentication

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/auth/login` | Redirect to ID authorize |
| GET | `/api/v1/auth/callback` | OIDC callback, create session |

### Internal

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/internal/session/establish` | Create session (signed callback from ID) |

## CSRF Flow

- `GET /api/v1/csrf` вызывает Django `get_token()` и выставляет host-only CSRF-cookie.
- Все browser-origin mutating routes в основном BFF router защищены через стандартный Django `csrf_protect`.
- `POST /api/v1/internal/session/establish` остаётся без browser CSRF, потому что защищён HMAC-подписью от UpdSpaceID.
- `DELETE /api/v1/account/me` использует тот же browser CSRF path, что и остальные mutating BFF endpoints.

## DSAR Orchestration

- `GET /api/v1/account/me/export` агрегирует bundles из `portal`, `activity`, `access`, `events`, `gamification`, `voting` и локального BFF session/audit store.
- `DELETE /api/v1/account/me` вызывает internal erase endpoints тех же сервисов, затем делает `DELETE auth/me` в identity provider и удаляет BFF cookie/session.
- BFF пишет audit события `dsar.exported`, `dsar.erased` и `account.deleted` с PII-safe metadata.

## Proxy Routes

### Personalization

```
/api/v1/personalization/* → http://access:8002/api/v1/personalization/*
```

| Frontend Path | Backend Path |
|---------------|--------------|
| `/api/v1/personalization/preferences` | `/api/v1/personalization/preferences` |
| `/api/v1/personalization/preferences/defaults` | `/api/v1/personalization/preferences/defaults` |
| `/api/v1/personalization/admin/dashboards/layouts` | `/api/v1/personalization/admin/dashboards/layouts` |

### Portal

```
/api/v1/portal/* → http://portal:8003/api/v1/*
```

| Frontend Path | Backend Path |
|---------------|--------------|
| `/api/v1/portal/me` | `/api/v1/me` |
| `/api/v1/portal/communities` | `/api/v1/communities` |
| `/api/v1/portal/teams` | `/api/v1/teams` |
| `/api/v1/portal/posts` | `/api/v1/posts` |

### Voting

```
/api/v1/voting/* → http://voting:8004/api/v1/*
```

| Frontend Path | Backend Path |
|---------------|--------------|
| `/api/v1/voting/polls` | `/api/v1/polls` |
| `/api/v1/voting/votes` | `/api/v1/votes` |
| `/api/v1/voting/nominations` | `/api/v1/nominations` |

### Events

```
/api/v1/events/* → http://events:8005/api/v1/events/*
```

| Frontend Path | Backend Path |
|---------------|--------------|
| `/api/v1/events` | `/api/v1/events/` |
| `/api/v1/events/` | `/api/v1/events/` |
| `/api/v1/events/{id}/rsvp` | `/api/v1/events/{id}/rsvp` |

### Activity

```
/api/v1/activity/* → http://activity:8006/api/v1/*
```

| Frontend Path | Backend Path |
|---------------|--------------|
| `/api/v1/activity/feed` | `/api/v1/feed` |
| `/api/v1/activity/games` | `/api/v1/games` |

## Proxy Implementation

```python
# bff/proxy.py
import httpx
from django.http import HttpResponse

ROUTES = {
    "portal": ("http://portal:8003", "/api/v1/portal"),
    "voting": ("http://voting:8004", "/api/v1/voting"),
    "events": ("http://events:8005", "/api/v1/events"),
    "activity": ("http://activity:8006", "/api/v1/activity"),
}

async def proxy_request(request, service: str, path: str):
    base_url, prefix = ROUTES[service]
    target_path = path.replace(prefix, "", 1)
    target_url = f"{base_url}/api/v1{target_path}"
    
    headers = build_proxy_headers(request)
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=request.body,
        )
    
    return HttpResponse(
        response.content,
        status=response.status_code,
        content_type=response.headers.get("content-type"),
    )
```

## Header Injection

```python
def build_proxy_headers(request):
    timestamp = int(time.time())
    
    headers = {
        "X-Request-Id": request.request_id,
        "X-Tenant-Id": str(request.tenant.id),
        "X-Tenant-Slug": request.tenant.slug,
        "X-Updspace-Timestamp": str(timestamp),
    }
    
    if request.session:
        headers["X-User-Id"] = str(request.session.user_id)
        headers["X-Master-Flags"] = json.dumps(request.session.master_flags)
    
    # HMAC signature
    signature = sign_request(
        method=request.method,
        path=request.path,
        body=request.body.decode(),
        request_id=request.request_id,
        timestamp=timestamp,
        secret=settings.BFF_INTERNAL_HMAC_SECRET,
    )
    headers["X-Updspace-Signature"] = signature
    
    return headers
```

## Error Handling

### Upstream Errors

Ошибки от сервисов пробрасываются как есть:

```python
async def proxy_request(request, service, path):
    try:
        response = await client.request(...)
        return HttpResponse(response.content, status=response.status_code)
    except httpx.ConnectError:
        return JsonResponse({
            "error": {
                "code": "SERVICE_UNAVAILABLE",
                "message": f"Service {service} is temporarily unavailable",
                "request_id": request.request_id,
            }
        }, status=503)
```

### Timeout

```python
async with httpx.AsyncClient(timeout=10.0) as client:
    try:
        response = await client.request(...)
    except httpx.TimeoutException:
        return JsonResponse({
            "error": {
                "code": "TIMEOUT",
                "message": "Request timed out",
            }
        }, status=504)
```

## Authentication Required

Некоторые routes требуют сессию:

```python
REQUIRE_AUTH = [
    "/api/v1/portal/me",
    "/api/v1/voting/votes",
    "/api/v1/events/*/rsvp",
]

def check_auth(request, path):
    if any(match_pattern(path, p) for p in REQUIRE_AUTH):
        if not request.session:
            raise Unauthorized("Session required")
```

## Dev Mode Shortcuts

В dev режиме BFF может:

1. **Auto-create tenant**: Если tenant не существует
2. **Skip HMAC**: Если `BFF_DEV_SKIP_HMAC=true`
3. **Return magic link**: Вместо отправки email
