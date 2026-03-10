---
title: Communities, Teams, Posts
---

# Communities, Teams, Posts

Исторически часть UX называлась guild-like сущностями, но в текущем коде canonical domain vocabulary такая:

- `Community`
- `Team`
- `Post`

## Communities

Community - более широкая организационная единица tenant-а. С ней связаны:

- membership checks;
- visibility scopes в Events;
- возможные будущие admin workflows.

## Teams

Team - более узкая группа внутри tenant-а. Важна для:

- membership-restricted events;
- потенциально более детализированной ролевой модели;
- social organization внутри tenant-а.

## Posts

`Post` в Portal сейчас играет роль lightweight content object внутри tenant domain. Если post/feed logic станет сложнее, ее нужно будет явно отделять от `Activity`, который уже владеет лентой и news.
