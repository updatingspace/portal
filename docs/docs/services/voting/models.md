---
title: Legacy and Tenant Voting
---

# Legacy and Tenant Voting

## Legacy models

Legacy слой живет в `services/voting/src/nominations` и `services/voting/src/votings`.

Ключевые сущности:

- `Game`
- `Voting`
- `VotingSettings`
- `Nomination`
- `NominationOption`
- `NominationVote`

Эти модели важны для совместимости и исторических сценариев, но они не задают направление новой разработки.

## Tenant-aware models

Новый слой в `tenant_voting` включает:

- `Poll`
- `Nomination`
- `Option`
- `PollParticipant`
- `PollInvite`
- `Vote`
- `OutboxMessage`

## Why the split matters

- legacy vocabulary использует старые identifiers и старую форму API;
- tenant-aware layer уже строится вокруг `tenant_id`, UUID ids, visibility и explicit poll roles;
- frontend в новых сценариях должен ориентироваться на poll API.

## Canonical capabilities

Примеры прав, которые фигурируют в коде:

- `voting.poll.read`
- `voting.votings.admin`

Если вы добавляете новую voting capability, документируйте ее одновременно в Access и в этом разделе.
