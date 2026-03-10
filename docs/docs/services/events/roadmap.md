---
title: Operational Notes
---

# Operational Notes

Хотя файл исторически назывался roadmap, в актуальном наборе документации он используется как короткая операционная памятка по сервису Events.

## What to verify after changes

- list/detail endpoints корректно уважают visibility;
- RSVP counts и my RSVP не ломаются при частичных обновлениях;
- community/team membership fallback не выдает лишнего доступа;
- `ICS` export не ломает timezone serialization.

## Integration risks

- деградация `Portal` влияет на membership-based event visibility;
- деградация `Access` блокирует create/update и часть read decisions;
- широкие изменения в enum-ах visibility или scope type требуют обновления frontend filters.
