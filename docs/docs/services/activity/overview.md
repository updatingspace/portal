---
title: Activity Overview
---

# Activity Overview

Activity - самый широкий по функциям сервис в platform mesh. Он объединяет feed, news, subscriptions и external connectors.

## Subdomains inside Activity

| Subdomain | Purpose |
| --- | --- |
| Feed | list feed, unread count, long-poll updates |
| News | posts, comments, reactions, media |
| Connectors | games, sources, account links, sync |
| Delivery | subscriptions and feed-side effects |
| Ingestion | raw events and normalized activity events |

## Main models

- `Game`
- `Source`
- `AccountLink`
- `RawEvent`
- `ActivityEvent`
- `NewsPost`
- `NewsReaction`
- `NewsComment`
- `NewsCommentReaction`
- `Subscription`
- `Outbox`
- `FeedLastSeen`

## Service shape

```mermaid
flowchart TD
    Feed["Feed APIs"]
    News["News APIs"]
    Connectors["Connector APIs"]
    Sync["Sync and ingestion"]
    Models["Activity models"]

    Feed --> Models
    News --> Models
    Connectors --> Models
    Sync --> Models
```

## Internal module graph

```mermaid
flowchart LR
    BFF["BFF"] --> API["activity/api.py"]
    API --> Context["context.py"]
    API --> Permissions["permissions.py"]
    API --> Services["services.py"]
    API --> Media["media.py"]
    API --> SSE["sse.py"]
    Services --> Models["models.py"]
    Services --> Connectors["connectors/*"]
    Permissions --> Access["Access"]
```

## Outbound interactions

```mermaid
flowchart LR
    Activity["Activity"] --> Access["Access"]
    Activity --> Providers["External connector providers"]
```

## Why this service deserves extra care

Activity touches:

- user-generated content;
- external account linking;
- normalized behavioral events;
- media uploads;
- feed personalization.

Поэтому любые изменения здесь нужно смотреть одновременно как backend feature и как privacy-sensitive surface.
