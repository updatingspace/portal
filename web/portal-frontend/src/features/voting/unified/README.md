# Unified Voting API

Unified API layer that bridges Legacy (Nominations) and Modern (Polls) voting systems in UpdSpace Portal.

## Overview

The voting system has two parallel implementations:
- **Legacy** (`/voting/nominations`) - Old nomination-based voting
- **Modern** (`/voting/polls`) - New tenant-based voting with advanced features

This unified layer provides a consistent interface for both systems, enabling gradual migration.

## Architecture

```
┌─────────────────────────────────────┐
│         Components/Pages            │
│  (HomePage, VotingPage, etc.)       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Unified Hooks (TanStack Query) │
│  useVotingSession useVotingSessions │
│  useCastVoteUnified  etc.           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│         Unified API Layer           │
│  fetchVotingSessions submitVote     │
│  Auto-routing to legacy/modern      │
└──────────────┬──────────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
┌──────────┐      ┌──────────┐
│  Legacy  │      │  Modern  │
│   API    │      │   API    │
└──────────┘      └──────────┘
```

## Installation

```typescript
import {
  useVotingSessionsAuto,
  useCastVoteUnified,
  adaptLegacyVotingToPoll,
  type VotingSession,
} from '@/features/voting/unified';
```

## Usage

### Fetching Voting Sessions

```typescript
// Auto-detect API (prefers modern)
const { data, isLoading } = useVotingSessionsAuto();

// Explicitly use legacy API
const { data } = useLegacyVotings();

// Explicitly use modern API
const { data } = useVotingSessions(
  { scope_type: 'TENANT', status: 'active' },
  { useLegacy: false }
);
```

### Fetching Single Voting Session

```typescript
// Auto-detect based on ID format (UUID → modern, other → legacy)
const { data: voting } = useVotingSessionAuto(id);

// Explicitly specify API
const { data } = useVotingSession(id, { useLegacy: true });
```

### Casting Votes

```typescript
const castVote = useCastVoteUnified();

// Cast vote (auto-detects API)
await castVote.mutateAsync({
  pollId: '123e4567-e89b-12d3-a456-426614174000', // Modern ID
  nominationId: 'nomination-1',
  optionId: 'option-1',
});

// Cast vote (legacy API)
const castVoteLegacy = useCastVoteUnified({ useLegacy: true });
await castVoteLegacy.mutateAsync({
  nominationId: 'nom-1',
  optionId: 'opt-1',
});
```

### Fetching Nomination (Legacy Only)

```typescript
const { data: nomination } = useNomination(nominationId);

// nomination is LegacyVotingQuestion type with adapted structure
```

## Type System

### Unified Types

```typescript
VotingSession      // Poll (modern) or Voting (legacy)
VotingQuestion     // Nomination in both APIs
VotingAnswer       // Option (modern) or NominationOption (legacy)
UserVote           // Vote record
```

### Legacy Bridge Types

```typescript
LegacyVotingSession       // extends Poll with legacy fields
LegacyVotingQuestion      // extends Nomination with legacy fields
LegacyVotingAnswer        // extends Option with legacy fields
```

### Type Guards

```typescript
import { isLegacyPoll, isLegacyNomination } from '@/features/voting/unified';

if (isLegacyPoll(poll)) {
  // poll is LegacyVotingSession
  console.log(poll.nominationCount); // Legacy-specific field
}
```

## Adapter Functions

Convert legacy data to modern structure:

```typescript
import {
  adaptLegacyVotingToPoll,
  adaptLegacyNominationToModern,
} from '@/features/voting/unified';

// Convert legacy catalog item to Poll
const poll = adaptLegacyVotingToPoll(catalogItem);

// Convert legacy nomination to modern Nomination
const modernNomination = adaptLegacyNominationToModern(legacyNomination, pollId);
```

## API Configuration

```typescript
interface ApiConfig {
  /**
   * Use legacy API endpoints
   * If true, routes to /voting/nominations
   * If false, routes to /voting/polls
   */
  useLegacy?: boolean;
  
  /**
   * Endpoint override for testing
   */
  endpoint?: string;
}
```

## Auto-Detection

The unified API can auto-detect which backend to use based on ID format:

```typescript
import { detectApi, isLegacyId } from '@/features/voting/unified';

// UUIDs → modern API
isLegacyId('123e4567-e89b-12d3-a456-426614174000'); // false

// Other formats → legacy API
isLegacyId('nom-123'); // true

// Auto-detect config
const config = detectApi(id);
// { useLegacy: true/false }
```

## Optimistic Updates

Both legacy and modern APIs support optimistic updates:

```typescript
const castVote = useCastVoteUnified();

// On vote cast:
// 1. UI updates immediately (optimistic)
// 2. Request sent to server
// 3. On success: Refresh related queries
// 4. On error: Rollback optimistic update

await castVote.mutateAsync({ pollId, nominationId, optionId });
```

## Rate Limit Handling

```typescript
import { isRateLimitError } from '@/features/voting/unified';

const castVote = useCastVoteUnified();

castVote.mutate(payload, {
  onError: (error) => {
    if (isRateLimitError(error)) {
      // error.retryAfter - seconds to wait
      // error.limit - max requests
      // error.window - time window in seconds
      console.log(`Rate limited. Retry after ${error.retryAfter}s`);
    }
  },
});
```

## Migration Guide

### Migrating from Legacy API

**Before (direct legacy API):**
```typescript
import { fetchVotingCatalog } from '@/api/votings';
import { voteForOption } from '@/api/nominations';

const catalog = await fetchVotingCatalog();
await voteForOption({ nominationId, optionId });
```

**After (unified API):**
```typescript
import {
  useVotingSessions,
  useCastVoteUnified,
} from '@/features/voting/unified';

const { data: catalog } = useVotingSessions(undefined, { useLegacy: true });
const castVote = useCastVoteUnified({ useLegacy: true });
await castVote.mutateAsync({ nominationId, optionId });
```

### Migrating to Modern API

1. Replace `useLegacyVotings()` with `useVotingSessionsAuto()`
2. Replace `useNomination(id)` with `useVotingSession(id)`
3. Replace `useCastVoteUnified({ useLegacy: true })` with `useCastVoteUnified()`
4. Update component props to use `VotingSession` instead of `LegacyVotingSession`

## Files

```
features/voting/
├── types/
│   └── unified.ts          # Unified type definitions & adapters
├── api/
│   └── unifiedApi.ts       # Unified API functions
├── hooks/
│   └── useVotingUnified.ts # TanStack Query hooks
└── unified/
    ├── index.ts            # Public exports
    └── README.md           # This file
```

## Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useVotingSessions } from '@/features/voting/unified';

test('fetches voting sessions', async () => {
  const { result } = renderHook(() => useVotingSessions());
  
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toBeDefined();
});
```

## Best Practices

1. **Prefer auto-detection**: Use `useVotingSessionAuto()` instead of explicitly setting `useLegacy`
2. **Type guards**: Use `isLegacyPoll()` when handling both types in same component
3. **Optimistic updates**: Enabled by default for both APIs
4. **Error handling**: Always check for `isRateLimitError()`
5. **Migration**: Gradually replace legacy components with unified hooks

## Limitations

### Legacy API Limitations

- ❌ No vote revocation support
- ❌ No dedicated `/my-votes` endpoint (use nomination.userVote field)
- ❌ No dedicated `/results` endpoint (use nomination.counts field)
- ❌ No tenant support (all votings are global)
- ❌ No voting session detail endpoint (fetch nominations individually)

### Modern API Features (not in legacy)

- ✅ Vote revocation (`allow_revoting` setting)
- ✅ Anonymous voting
- ✅ Custom results visibility
- ✅ Multi-tenant support
- ✅ Advanced scoping (COMMUNITY, TEAM, EVENT, POST)
- ✅ Voting templates

## FAQ

**Q: When should I use unified API vs modern API directly?**  
A: Use unified API when building components that need to support both systems during migration. Use modern API directly for new features that don't require legacy support.

**Q: How do I know which API a voting is using?**  
A: Check the ID format (UUID = modern) or use `isLegacyPoll(poll)` type guard.

**Q: Can I mix legacy and modern votings in the same list?**  
A: Yes! The unified API returns both types as `VotingSession`. Use type guards to handle legacy-specific fields.

**Q: What happens if I try to revoke a vote in legacy API?**  
A: The hook will throw an error. Check `isLegacyPoll()` before showing revoke button.

## Support

For questions or issues, contact the UpdSpace Portal team or open an issue in the repository.
