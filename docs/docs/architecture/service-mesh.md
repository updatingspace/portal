---
title: Service Mesh and Runtime Graph
---

# Service Mesh and Runtime Graph

Этот раздел нужен для чтения платформы как распределенной системы. Здесь зафиксировано, кто с кем разговаривает, через какие trust boundaries и где живет authoritative state.

## 1. Full runtime graph

```mermaid
flowchart TB
    User["User Browser"]
    Frontend["Portal Frontend"]
    Edge["Traefik / edge router"]
    BFF["BFF"]
    ID["UpdSpaceID"]
    Redis["Redis"]

    Access["Access"]
    Portal["Portal"]
    Voting["Voting"]
    Events["Events"]
    Activity["Activity"]
    Gamification["Gamification"]

    DBA["db_access"]
    DBP["db_portal"]
    DBV["db_voting"]
    DBE["db_events"]
    DBAct["db_activity"]
    DBG["db_gamification"]
    DBB["db_bff"]
    DBID["db_id"]

    User --> Frontend
    Frontend --> Edge
    Edge --> BFF
    Edge --> ID

    BFF --> ID
    BFF --> Redis
    BFF --> Access
    BFF --> Portal
    BFF --> Voting
    BFF --> Events
    BFF --> Activity
    BFF --> Gamification

    Events --> Portal
    Events --> Access
    Portal --> Access
    Voting --> Access
    Activity --> Access
    Gamification --> Access

    Access --> DBA
    Portal --> DBP
    Voting --> DBV
    Events --> DBE
    Activity --> DBAct
    Gamification --> DBG
    BFF --> DBB
    ID --> DBID
```

## 2. Browser route ownership graph

```mermaid
flowchart LR
    Browser["Browser routes"] --> BFF["BFF public surface"]
    BFF --> Session["/session/*"]
    BFF --> Auth["/auth/* and /account/*"]
    BFF --> PortalRoutes["/portal, /communities, /teams, /posts"]
    BFF --> VotingRoutes["/polls, /votes, /nominations, /votings"]
    BFF --> EventRoutes["/events/*"]
    BFF --> FeedRoutes["/feed, /news, /account-links, /sources"]
    BFF --> GamificationRoutes["/gamification/*"]
    BFF --> AccessRoutes["/access/*, /rollout/*, /personalization/*"]
```

## 3. State ownership graph

```mermaid
flowchart LR
    BFF["BFF"] -->|"owns"| BFFState["browser sessions, active tenant context"]
    Access["Access"] -->|"owns"| AccessState["permissions, roles, bindings, rollout config"]
    Portal["Portal"] -->|"owns"| PortalState["tenant profiles, communities, teams, posts"]
    Voting["Voting"] -->|"owns"| VotingState["polls, nominations, votes, legacy voting records"]
    Events["Events"] -->|"owns"| EventState["events, RSVP, attendance"]
    Gamification["Gamification"] -->|"owns"| GameState["categories, achievements, grants"]
    Activity["Activity"] -->|"owns"| ActivityState["news, feed, account links, raw and normalized activity"]
    ID["UpdSpaceID"] -->|"owns"| IdentityState["accounts, identity sessions, MFA and passkeys"]
```

## 4. Request trust zones

```mermaid
flowchart LR
    subgraph Public["Public/browser zone"]
        Browser["Browser"]
        Frontend["Frontend bundle"]
    end

    subgraph Gateway["Gateway zone"]
        BFF["BFF"]
    end

    subgraph Internal["Internal service zone"]
        Access["Access"]
        Portal["Portal"]
        Voting["Voting"]
        Events["Events"]
        Activity["Activity"]
        Gamification["Gamification"]
    end

    subgraph External["External dependency zone"]
        ID["UpdSpaceID"]
        Providers["External connectors"]
    end

    Browser -->|"cookie session"| BFF
    BFF -->|"HMAC + X-* context"| Access
    BFF -->|"HMAC + X-* context"| Portal
    BFF -->|"HMAC + X-* context"| Voting
    BFF -->|"HMAC + X-* context"| Events
    BFF -->|"HMAC + X-* context"| Activity
    BFF -->|"HMAC + X-* context"| Gamification
    BFF -->|"auth proxy / callbacks"| ID
    Activity -->|"connector sync"| Providers
```

## 5. Cross-service business flows

### Login and session bootstrap

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BFF
    participant ID as UpdSpaceID
    participant Access
    participant Portal

    FE->>BFF: POST /auth/login
    BFF->>ID: proxy login
    ID-->>BFF: authenticated principal
    BFF-->>FE: session cookie + sanitized payload
    FE->>BFF: GET /session/me
    BFF->>Access: capability probes
    BFF->>Portal: own profile projection
    BFF-->>FE: user, tenant, profile, capability state
```

### Event visibility path

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BFF
    participant Events
    participant Portal
    participant Access

    FE->>BFF: GET /events/{id}
    BFF->>Events: internal request
    Events->>Portal: community/team membership lookup when needed
    Portal-->>Events: membership result
    Events->>Access: permission fallback
    Access-->>Events: allowed or denied
    Events-->>BFF: event detail
    BFF-->>FE: response
```

### Poll management path

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BFF
    participant Voting
    participant Access

    FE->>BFF: create or update poll
    BFF->>Voting: internal HMAC request
    Voting->>Access: permission check
    Access-->>Voting: decision
    Voting-->>BFF: poll payload
    BFF-->>FE: response
```

## 6. Design implications

- BFF остается главным integration seam для browser-visible features.
- Access является общей policy plane, но не доменным owner для контента.
- Portal, Events и Voting используют совместно понятие tenant/community/team scope, поэтому их контракты нужно менять синхронно.
- Activity наиболее интеграционно насыщен: он одновременно касается внешних connectors, feed UX и privacy-sensitive data handling.
