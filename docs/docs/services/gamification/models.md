---
title: Gamification Data Model
---

# Gamification Data Model

## Main models

| Model | Role |
| --- | --- |
| `AchievementCategory` | taxonomy for achievements |
| `Achievement` | definitional object for awardable achievement |
| `AchievementGrant` | issuance record to a recipient |
| `OutboxMessage` | event propagation boundary |

## Lifecycle

`Achievement` status currently travels through domain-specific states such as draft, published, active, hidden. Management rights and UI affordances зависят от этих состояний.

## Ownership note

Gamification хранит факты о выдаче достижений, но не является общей системой ролей или identity. Recipient and issuer IDs приходят из более широкого platform context.
