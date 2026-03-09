---
title: RBAC and Rollout
---

# RBAC and Rollout

## How access decisions are computed

В центре сервиса лежит `compute_effective_access(...)`. На вход в типичном случае приходят:

- `tenant_id`
- `user_id`
- `permission_key`
- `scope_type`
- `scope_id`
- `master_flags`

Решение складывается из:

- role bindings;
- policy overrides;
- system-level master flags;
- scope-aware filtering.

## Common scope types

- `TENANT`
- `COMMUNITY`
- `TEAM`

Конкретный сервис может использовать более узкий смысл scope, но Access остается authority по самому capability decision.

## Tenant admin surface

Access уже содержит tenant admin API для:

- list/create roles;
- bind/unbind roles;
- list permissions;
- list audit events;
- работать с policy overrides.

Это важный момент: tenant admin не является отдельным сервисом, он опирается на Access.

## Rollout subdomain

Помимо RBAC, Access хранит rollout control plane:

- feature flags;
- experiments;
- kill switches.

Этот набор нужен, чтобы продуктовые и операционные переключатели не размазывались по разным сервисам и env vars.

## Operational note

При изменении permission catalog обязательно обновляются:

- seed data или миграции, если каталог поддерживается кодом;
- frontend capability guards;
- документация permission naming.
