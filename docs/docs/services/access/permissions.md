---
title: Permission Naming
---

# Permission Naming

В проекте используется capability naming в формате:

```text
{service}.{resource}.{action}
```

Примеры:

- `portal.profile.read_self`
- `activity.feed.read`
- `events.event.create`
- `voting.poll.read`
- `gamification.achievements.assign`

## Why naming matters

Единый формат нужен для трех вещей:

- понятно читать guards и service checks;
- не плодить синонимы одного и того же права;
- поддерживать прогнозируемые tenant admin интерфейсы.

## Рекомендации

- `service` должен совпадать с bounded context, а не с названием страницы;
- `resource` должен быть устойчивым доменным существительным;
- `action` должен быть коротким и недвусмысленным;
- если нужен master flag, он не должен притворяться обычным permission key.

## Smells

- `portal.admin` вместо предметного `portal.roles.read` или `portal.communities.manage`;
- смешивание UI state и capability semantics;
- использование одного permission key для чтения и мутаций.
