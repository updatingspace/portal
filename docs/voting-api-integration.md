# Voting API Integration Guide

This guide explains how to use the unified voting API layer in UpdSpace Portal frontend.

## Overview

The voting system supports two API backends:
- **Legacy API** (`/voting/nominations`) - Original nomination-based voting
- **Modern API** (`/voting/polls`) - New tenant-based polling system

The **unified API layer** abstracts these differences, allowing seamless migration.

---

## Quick Start

### 1. Import Hooks

```tsx
import {
  useVotingSessions,
  useVotingSession,
  useNominationDetail,
  useCastVoteUnified,
  useRevokeVoteUnified,
} from '@/features/voting/hooks/useVotingUnified';
```

### 2. Fetch Voting Sessions

```tsx
function VotingCatalog() {
  const { data, isLoading, error, refetch } = useVotingSessions();

  if (isLoading) return <VotingListSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return <VotingList votings={data} />;
}
```

### 3. Fetch Single Session

```tsx
function VotingDetail({ id }: { id: string }) {
  const { data: voting, isLoading } = useVotingSession(id);

  if (isLoading) return <Skeleton />;

  return (
    <div>
      <h1>{voting?.title}</h1>
      <p>{voting?.description}</p>
    </div>
  );
}
```

### 4. Cast a Vote

```tsx
function VoteForm({ sessionId, questionId }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const castVote = useCastVoteUnified();

  const handleVote = async () => {
    await castVote.mutateAsync({
      sessionId,
      questionId,
      nominationId: selected!,
    });
  };

  return (
    <div>
      {/* Option selection UI */}
      <Button
        onClick={handleVote}
        loading={castVote.isPending}
        disabled={!selected}
      >
        Vote
      </Button>
    </div>
  );
}
```

---

## API Layer Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    React Components                       │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│               useVotingUnified.ts                         │
│  (TanStack Query hooks with optimistic updates)          │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│                 unifiedApi.ts                             │
│  (Auto-routing between legacy and modern APIs)           │
└──────────────────────────────────────────────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────┐  ┌─────────────────────────────┐
│   Legacy API            │  │   Modern API                 │
│   /voting/nominations   │  │   /voting/polls             │
└─────────────────────────┘  └─────────────────────────────┘
```

---

## Hooks Reference

### useVotingSessions

Fetches all voting sessions with automatic caching.

```typescript
const {
  data,           // VotingSession[] | undefined
  isLoading,      // boolean
  isFetching,     // boolean (background refetch)
  error,          // Error | null
  refetch,        // () => Promise<...>
} = useVotingSessions({
  status?: 'active' | 'draft' | 'closed',  // Filter by status
  tenantId?: string,                        // Filter by tenant
});
```

**Query Key**: `['voting', 'sessions', filters]`  
**Stale Time**: 30 seconds  
**Cache Time**: 5 minutes

### useVotingSession

Fetches a single voting session with its questions/nominations.

```typescript
const {
  data,           // VotingSession | undefined
  isLoading,
  error,
  refetch,
} = useVotingSession(sessionId: string, {
  enabled?: boolean,  // Conditional fetching
});
```

**Query Key**: `['voting', 'session', sessionId]`

### useNominationDetail

Fetches a single nomination with options and vote counts.

```typescript
const {
  data,           // Nomination | undefined
  isLoading,
  error,
  refetch,
} = useNominationDetail(nominationId: string, {
  enabled?: boolean,
});
```

**Query Key**: `['voting', 'nomination', nominationId]`

### useCastVoteUnified

Mutation hook for casting votes with optimistic updates.

```typescript
const {
  mutate,         // (params) => void
  mutateAsync,    // (params) => Promise<VoteResponse>
  isPending,      // boolean
  isSuccess,      // boolean
  isError,        // boolean
  error,          // Error | null
  reset,          // () => void
} = useCastVoteUnified();

// Usage
castVote.mutate({
  sessionId: 'poll-123',
  questionId: 'question-456',
  nominationId: 'option-789',
});
```

**Optimistic Updates**: 
- Immediately updates vote count in cache
- Rolls back on error

**Invalidates**:
- `['voting', 'session', sessionId]`
- `['voting', 'nomination', questionId]`
- `['voting', 'my-votes']`

### useRevokeVoteUnified

Mutation hook for revoking votes (modern API only).

```typescript
const {
  mutate,
  mutateAsync,
  isPending,
} = useRevokeVoteUnified();

// Usage (only works with modern API)
revokeVote.mutate({
  sessionId: 'poll-123',
  voteId: 'vote-abc',
});
```

**Note**: Legacy API does not support vote revocation.

---

## Type System

### VotingSession

Unified type representing both legacy votings and modern polls.

```typescript
interface VotingSession {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'draft' | 'closed';
  starts_at?: string;
  ends_at?: string;
  created_at: string;
  updated_at: string;
  
  // Optional fields
  tenant_id?: string;
  questions?: VotingQuestion[];
  
  // Legacy-specific (via adapter)
  nominationCount?: number;
  imageUrl?: string;
  isActive?: boolean;
  isOpen?: boolean;
}
```

### Type Guards

```typescript
import { isLegacyPoll, isLegacyNomination } from '@/features/voting/unified';

// Check if session came from legacy API
if (isLegacyPoll(votingSession)) {
  console.log('Legacy nomination count:', votingSession.nominationCount);
}
```

### Adapters

```typescript
import {
  adaptLegacyVotingToPoll,
  adaptLegacyNominationToModern,
} from '@/features/voting/unified';

// Convert legacy voting to unified format
const unified = adaptLegacyVotingToPoll(legacyVoting);
```

---

## Error Handling

### Error Types

```typescript
interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | No permission to vote |
| `NOT_FOUND` | 404 | Voting/nomination not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `VOTING_CLOSED` | 400 | Voting deadline passed |
| `ALREADY_VOTED` | 400 | Cannot change vote |

### Error Handling Pattern

```tsx
function VotingPage() {
  const { error, refetch } = useVotingSession(id);
  const castVote = useCastVoteUnified();

  // Handle fetch errors
  useEffect(() => {
    if (error?.code === 'UNAUTHORIZED') {
      navigate('/login');
    }
  }, [error]);

  // Handle mutation errors
  const handleVote = async () => {
    try {
      await castVote.mutateAsync(params);
      toast.success('Vote submitted!');
    } catch (err) {
      if (err.code === 'RATE_LIMITED') {
        toast.warning(`Wait ${err.details.retryAfter} seconds`);
      } else {
        toast.error(err.message);
      }
    }
  };
}
```

---

## Rate Limiting

### Client-Side Handling

The unified API layer includes automatic rate limit handling:

```typescript
// Rate limit info is tracked per session
const rateLimit = {
  remaining: 10,
  resetAt: Date.now() + 60000,
};

// Countdown UI component
function RateLimitWarning({ retryAfter }: { retryAfter: number }) {
  const [seconds, setSeconds] = useState(retryAfter);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (seconds === 0) return null;

  return (
    <Alert theme="warning">
      Please wait {seconds} seconds before voting again
    </Alert>
  );
}
```

### Retry Logic

```typescript
const castVote = useCastVoteUnified();

const handleVoteWithRetry = async () => {
  const MAX_RETRIES = 3;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await castVote.mutateAsync(params);
      return; // Success
    } catch (err) {
      if (err.code === 'RATE_LIMITED') {
        const delay = err.details?.retryAfter ?? Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err; // Non-retryable error
      }
    }
  }
  
  throw new Error('Max retries exceeded');
};
```

---

## Optimistic Updates

### How It Works

1. **User clicks "Vote"**
2. **Cache is immediately updated** (optimistic)
3. **Request sent to server**
4. **On success**: Cache invalidated, fresh data fetched
5. **On error**: Cache rolled back to previous state

### Implementation

```typescript
// In useCastVoteUnified
const mutation = useMutation({
  mutationFn: submitVote,
  onMutate: async (variables) => {
    // Cancel outgoing queries
    await queryClient.cancelQueries({ queryKey: votingKeys.session(sessionId) });
    
    // Snapshot previous value
    const previous = queryClient.getQueryData(votingKeys.session(sessionId));
    
    // Optimistically update cache
    queryClient.setQueryData(votingKeys.session(sessionId), (old) => ({
      ...old,
      // Update vote count optimistically
    }));
    
    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(votingKeys.session(sessionId), context?.previous);
  },
  onSettled: () => {
    // Refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey: votingKeys.session(sessionId) });
  },
});
```

---

## Query Key Factory

Consistent query keys for cache management:

```typescript
export const votingKeysUnified = {
  all: ['voting'] as const,
  sessions: (filters?: SessionFilters) => 
    [...votingKeysUnified.all, 'sessions', filters] as const,
  session: (id: string) => 
    [...votingKeysUnified.all, 'session', id] as const,
  nomination: (id: string) => 
    [...votingKeysUnified.all, 'nomination', id] as const,
  myVotes: (sessionId?: string) => 
    [...votingKeysUnified.all, 'my-votes', sessionId] as const,
  results: (sessionId: string) => 
    [...votingKeysUnified.all, 'results', sessionId] as const,
};
```

### Manual Cache Operations

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { votingKeysUnified } from '@/features/voting/hooks/useVotingUnified';

function Component() {
  const queryClient = useQueryClient();

  // Invalidate all voting queries
  queryClient.invalidateQueries({ queryKey: votingKeysUnified.all });

  // Invalidate specific session
  queryClient.invalidateQueries({ queryKey: votingKeysUnified.session('123') });

  // Prefetch upcoming data
  queryClient.prefetchQuery({
    queryKey: votingKeysUnified.session('456'),
    queryFn: () => fetchVotingSession('456'),
  });

  // Update cache directly
  queryClient.setQueryData(votingKeysUnified.session('123'), (old) => ({
    ...old,
    title: 'Updated Title',
  }));
}
```

---

## Migration from Legacy Hooks

### Before (Legacy)

```tsx
// Direct API calls with useState
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  setLoading(true);
  fetchVotingCatalog()
    .then(setData)
    .finally(() => setLoading(false));
}, []);
```

### After (Unified)

```tsx
// TanStack Query hooks
const { data, isLoading, refetch } = useVotingSessions();
```

### Migration Checklist

- [ ] Replace `useState` + `useEffect` with `useVotingSessions`
- [ ] Replace manual fetch with `useVotingSession`
- [ ] Replace `voteForOption` with `useCastVoteUnified`
- [ ] Add error boundaries for React Query
- [ ] Update components to use `VotingSession` type
- [ ] Add loading skeletons using `isLoading` state
- [ ] Remove manual cache invalidation

---

## Best Practices

### 1. Enable DevTools

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### 2. Configure Query Client

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### 3. Use Suspense (Optional)

```tsx
import { useSuspenseQuery } from '@tanstack/react-query';

function VotingList() {
  // Will suspend until data is ready
  const { data } = useSuspenseQuery({
    queryKey: votingKeysUnified.sessions(),
    queryFn: fetchVotingSessions,
  });

  return <List items={data} />;
}

// Wrap with Suspense boundary
<Suspense fallback={<VotingListSkeleton />}>
  <VotingList />
</Suspense>
```

### 4. Prefetch on Hover

```tsx
function VotingCard({ voting }: Props) {
  const queryClient = useQueryClient();

  const handleHover = () => {
    // Prefetch session details on hover
    queryClient.prefetchQuery({
      queryKey: votingKeysUnified.session(voting.id),
      queryFn: () => fetchVotingSession(voting.id),
      staleTime: 60 * 1000,
    });
  };

  return (
    <Card onMouseEnter={handleHover}>
      {/* ... */}
    </Card>
  );
}
```
