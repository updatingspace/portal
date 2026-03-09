---
title: Tenant Admin Touchpoints
---

# Tenant Admin Touchpoints

Tenant admin experience в платформе распределен между сервисами.

## Что находится в Portal

В самом Portal лежат tenant-owned сущности, которыми часто управляет администратор:

- communities;
- teams;
- memberships;
- posts и профильный каталог.

## Что не находится в Portal

Ниже перечислено то, что администратор видит в UI, но что логически живет в других сервисах:

- roles and permissions - `Access`;
- feature flags and rollout - `Access`;
- polls and voting management - `Voting`;
- events calendar administration - `Events`;
- achievements and grants - `Gamification`.

## Почему это важно

`TenantAdminPage` на frontend выглядит как единый раздел, но backend ownership распределен. При изменениях админского UX всегда важно понять, какой сервис является authority для нужной части данных.
