---
title: Event Lifecycle and Integrations
---

# Event Lifecycle and Integrations

## Lifecycle

```mermaid
sequenceDiagram
    participant F as Frontend
    participant B as BFF
    participant E as Events
    participant A as Access
    participant P as Portal

    F->>B: create or update event
    B->>E: internal request with tenant context
    E->>A: permission check
    A-->>E: allow or deny
    E-->>B: event payload
    B-->>F: normalized response

    F->>B: view community or team event
    B->>E: get event
    E->>P: membership lookup if needed
    P-->>E: membership result
    E-->>B: event detail
```

## Integration notes

- `Portal` используется как membership authority для community/team scopes.
- `Access` остается authority по capability checks.
- `ICS` export делает Events useful вне UI, например для calendar clients.

## Why Event scope matters

У события есть не только `tenant_id`, но и domain-specific scope:

- tenant-wide;
- community-scoped;
- team-scoped;
- потенциально другие сценарии в будущем.

Это значит, что visibility и permission logic нельзя сводить к одному булевому флагу.
