---
title: Frontend Feature Modules
---

# Frontend Feature Modules

Хотя этот раздел исторически назывался `activity`, фактически он теперь покрывает структуру feature-level модулей frontend-а.

## Main feature areas

- `modules/feed`
- `modules/events`
- `modules/gamification`
- `modules/portal`
- `modules/tenantAdmin`
- `modules/voting`
- `features/events`
- `features/rbac`
- `features/voting`
- `features/navigation`

## Why both `modules` and `features` exist

Это отражает эволюцию кодовой базы:

- `modules` чаще описывают более крупные product areas;
- `features` содержат reusable or focused logic blocks.

Новая работа должна придерживаться одного понятного ownership path и не распылять API logic по случайным папкам.
