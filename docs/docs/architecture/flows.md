---
sidebar_position: 5
title: Основные потоки
description: Sequence diagrams ключевых процессов
---

# Основные потоки

## Регистрация и активация

### Application → Approve → Activate

```mermaid
sequenceDiagram
    participant User
    participant Portal
    participant BFF
    participant ID
    participant Admin
    participant Email

    User->>Portal: Заполняет заявку
    Portal->>BFF: POST /applications
    BFF->>ID: POST /applications
    ID->>ID: Сохранить Application(status=pending)
    ID-->>BFF: 201 Created
    BFF-->>Portal: Success

    Note over Admin: Админ проверяет заявку

    Admin->>Portal: Одобрить заявку
    Portal->>BFF: POST /applications/{id}/approve
    BFF->>ID: POST /applications/{id}/approve
    ID->>ID: Create User + TenantMembership
    ID->>ID: Create ActivationToken(one-time)
    ID->>Email: Отправить activation link
    ID-->>BFF: 200 OK
    BFF-->>Portal: Success

    Email->>User: Activation link
    User->>ID: GET /activate?token=xxx
    ID->>ID: Validate token (not used, not expired)
    ID->>ID: User.status = active, email_verified = true
    ID->>ID: Mark token as used
    ID-->>User: Redirect to portal
```

## Аутентификация

### Magic Link Login

```mermaid
sequenceDiagram
    participant User
    participant Portal
    participant BFF
    participant ID
    participant Email

    User->>Portal: Нажимает "Войти"
    Portal->>BFF: GET /auth/login?next=/app
    BFF->>BFF: Generate OAuth state
    BFF->>BFF: Store next path in cache
    BFF-->>User: Redirect to ID /oauth/authorize

    User->>ID: /oauth/authorize (consent if needed)
    ID-->>User: Redirect to BFF /auth/callback?code=xxx

    User->>BFF: GET /auth/callback?code=xxx&state=yyy
    BFF->>ID: POST /oauth/token (exchange code)
    ID-->>BFF: access_token, id_token
    BFF->>ID: GET /oauth/userinfo
    ID-->>BFF: user info + master flags
    BFF->>BFF: Create session in Redis
    BFF-->>User: Set-Cookie + redirect to /app
```

### OAuth Provider Login (уже привязан)

```mermaid
sequenceDiagram
    participant User
    participant ID
    participant GitHub

    User->>ID: POST /oauth/github/login/start
    ID->>ID: Generate state + nonce
    ID-->>User: Redirect to GitHub

    User->>GitHub: Authorize
    GitHub-->>User: Redirect to ID callback

    User->>ID: GET /oauth/github/login/callback?code=xxx
    ID->>GitHub: Exchange code → tokens
    GitHub-->>ID: access_token + user info
    ID->>ID: Find ExternalIdentity by subject
    
    alt ExternalIdentity exists
        ID->>ID: Login as linked user
        ID-->>User: Session created
    else Not linked
        ID-->>User: Error: ACCOUNT_NOT_LINKED
    end
```

## Голосование

### Cast Vote

```mermaid
sequenceDiagram
    participant User
    participant Portal
    participant BFF
    participant Voting
    participant Access
    participant DB

    User->>Portal: Выбирает опцию и голосует
    Portal->>BFF: POST /voting/votes
    Note right of Portal: {poll_id, nomination_id, option_id}

    BFF->>BFF: Validate session
    BFF->>Voting: POST /votes + X-Headers

    Voting->>Access: POST /check {voting.vote.cast}
    Access->>Access: Check master flags
    Access->>Access: Check RBAC
    Access-->>Voting: {allowed: true}

    Voting->>DB: Check unique constraint
    Note right of DB: (tenant_id, poll_id, nomination_id, user_id)

    alt Already voted
        DB-->>Voting: Constraint violation
        Voting-->>BFF: 409 ALREADY_VOTED
        BFF-->>Portal: Error
        Portal-->>User: "Вы уже голосовали"
    else New vote
        Voting->>DB: INSERT Vote
        Voting->>DB: INSERT OutboxEvent(vote.cast)
        Voting-->>BFF: 201 Created
        BFF-->>Portal: Success
        Portal-->>User: "Голос принят"
    end
```

## События

### RSVP Flow

```mermaid
sequenceDiagram
    participant User
    participant Portal
    participant BFF
    participant Events
    participant Access

    User->>Portal: Открывает событие
    Portal->>BFF: GET /events/{id}
    BFF->>Events: GET /events/{id}
    Events->>Access: POST /check {events.event.read}
    Access-->>Events: allowed
    Events-->>BFF: Event data
    BFF-->>Portal: Event + current RSVP

    User->>Portal: Нажимает "Пойду"
    Portal->>BFF: POST /events/{id}/rsvp {status: "going"}
    BFF->>Events: POST /events/{id}/rsvp

    Events->>Access: POST /check {events.rsvp.set}
    Access-->>Events: allowed

    Events->>Events: Upsert RSVP
    Events->>Events: Insert OutboxEvent(event.rsvp.changed)
    Events-->>BFF: 200 OK
    BFF-->>Portal: Success
    Portal-->>User: UI обновлён
```

## Activity Feed

### Sync + Normalize

```mermaid
sequenceDiagram
    participant Scheduler
    participant Activity
    participant Connector
    participant ExternalAPI
    participant DB

    Scheduler->>Activity: POST /sync/run?account_link_id=xxx

    Activity->>DB: Get AccountLink
    Activity->>Connector: Get connector for source_type
    
    Connector->>ExternalAPI: Fetch raw events
    ExternalAPI-->>Connector: Raw data

    loop For each raw event
        Connector->>Connector: dedupe_key(raw)
        Activity->>DB: Check RawEvent by dedupe_hash
        
        alt Already exists
            Note over Activity: Skip duplicate
        else New event
            Activity->>DB: INSERT RawEvent
            Connector->>Connector: normalize(raw) → ActivityEvent
            Activity->>DB: INSERT ActivityEvent
        end
    end

    Activity-->>Scheduler: Sync complete
```

### Webhook Ingest (Minecraft)

```mermaid
sequenceDiagram
    participant Minecraft
    participant Activity
    participant DB

    Minecraft->>Activity: POST /ingest/webhook/minecraft
    Note right of Minecraft: X-Webhook-Signature: HMAC(body, secret)

    Activity->>Activity: Validate HMAC signature
    Activity->>Activity: Validate timestamp (replay protection)

    alt Invalid signature
        Activity-->>Minecraft: 401 Unauthorized
    else Valid
        Activity->>DB: Find AccountLink by player_uuid
        Activity->>Activity: Create RawEvent + ActivityEvent
        Activity->>DB: INSERT with dedupe_hash
        Activity-->>Minecraft: 200 OK
    end
```

## Проверка доступа

### Access Check Flow

```mermaid
sequenceDiagram
    participant Service
    participant Access
    participant DB

    Service->>Access: POST /check
    Note right of Service: {tenant_id, user_id, action, scope}

    Access->>Access: Parse master_flags from headers

    alt suspended or banned
        Access-->>Service: {allowed: false, reason: "MASTER_DENY"}
    else system_admin
        Access->>DB: Log audit
        Access-->>Service: {allowed: true, reason: "SYSTEM_ADMIN"}
    else
        Access->>DB: Get PolicyOverrides
        alt Explicit DENY
            Access-->>Service: {allowed: false, reason: "POLICY_DENY"}
        else Explicit ALLOW
            Access-->>Service: {allowed: true, reason: "POLICY_ALLOW"}
        else
            Access->>DB: Get RoleBindings for user + scope
            Access->>DB: Get Permissions from Roles
            Access->>Access: Check if action in permissions
            alt Permission found
                Access-->>Service: {allowed: true, reason: "RBAC_ALLOW"}
            else
                Access-->>Service: {allowed: false, reason: "RBAC_DENY"}
            end
        end
    end
```
