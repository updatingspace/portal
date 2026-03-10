---
title: Retention Schedule
---

# Retention Schedule

Это baseline retention schedule. Фактические сроки могут быть скорректированы перед продовым launch review, но любое отклонение должно быть явно отражено и в коде, и в policy.

| Data class | Typical owner | Baseline retention |
| --- | --- | --- |
| Browser sessions | BFF | until expiry or revocation, plus limited audit tail |
| Role and policy audit data | Access | retained for accountability and admin history for a limited operational period |
| Portal profiles and tenant social graph | Portal | while account remains active and tenant relationship exists |
| Voting records | Voting | while poll history is needed for product and community record, subject to deletion workflows |
| Event participation | Events | while event history remains relevant and not erased by user-rights workflow |
| Achievement grants | Gamification | while achievement history remains part of tenant record, subject to rights handling |
| Raw connector events | Activity | short operational retention only |
| Normalized activity feed events | Activity | limited product retention based on visibility and feature need |
| News comments and reactions | Activity | until deletion, moderation, or retention trigger |

## Rule of thumb

- raw operational data should live shorter than user-facing normalized data;
- audit data should live long enough to support accountability;
- retention must be enforceable by job or management command, not only by policy text.
