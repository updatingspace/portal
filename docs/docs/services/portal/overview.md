---
title: Portal Overview
---

# Portal Overview

Portal - это доменный сервис, который хранит social and organizational core tenant-а:

- профиль участника;
- communities;
- teams;
- posts;
- membership relations.

## Main API surface

| Endpoint family | Purpose |
| --- | --- |
| `/portal/me` | own profile read/update |
| `/portal/profiles` | tenant profile listing and lookup |
| `/portal/modules` | enabled portal modules |
| `/communities` | communities CRUD-lite |
| `/teams` | teams CRUD-lite |
| `/posts` | tenant posts |

## Dependencies

Portal не использует shared auth state напрямую. Он получает `PortalContext` из BFF headers и ходит в Access за authorization.

## Module map

```mermaid
flowchart TD
    Context["PortalContext"]
    Profiles["PortalProfile API"]
    Communities["Community API"]
    Teams["Team API"]
    Posts["Post API"]
    Access["AccessService"]

    Context --> Profiles
    Context --> Communities
    Context --> Teams
    Context --> Posts
    Communities --> Access
    Teams --> Access
    Posts --> Access
```

## Inbound and outbound graph

```mermaid
flowchart LR
    BFF["BFF"] --> Security["security.py / bff_context_auth"]
    Security --> Context["PortalContext"]
    Context --> API["portal/api.py"]
    API --> Models["models.py"]
    API --> AccessSvc["access.py / AccessService"]
    AccessSvc --> Access["Access"]
```

## Why other services care about Portal

Portal не только обслуживает собственный UI. Он также является membership authority для других доменов, в первую очередь для Events и частично для tenant-aware UX flows.

## What Portal is not

Portal не является:

- identity authority;
- global permission engine;
- feed service;
- event calendar;
- achievement engine.

Он владеет именно tenant social graph и организационными сущностями.
