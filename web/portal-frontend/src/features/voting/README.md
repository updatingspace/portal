# Voting Feature

Полностью переписанный фронтенд для системы голосований UpdSpace Portal.

## Обзор

Voting Feature включает:
- **Unified API Layer** — единый интерфейс для legacy и modern API
- **TanStack Query Hooks** — кэширование, оптимистичные обновления
- **Redesigned Components** — VotingCard, NominationCard, ResultsVisualization
- **Accessibility** — WCAG 2.1 AA, keyboard navigation, screen readers
- **Performance** — prefetch, lazy loading, virtual scrolling

## Структура

```
src/features/voting/
├── api/
│   ├── unifiedApi.ts        # Unified API layer
│   └── ...                   # Legacy API files
├── components/
│   ├── VotingCard.tsx       # Voting session card
│   ├── VotingList.tsx       # Catalog with filters
│   ├── NominationCard.tsx   # Option card with selection
│   ├── VoteButton.tsx       # Submit button with states
│   ├── ResultsVisualization.tsx  # Charts & export
│   ├── VotingAlerts.tsx     # Contextual alerts
│   ├── ProgressiveDisclosure.tsx # Expand/collapse pattern
│   ├── skeletons/           # Loading placeholders
│   ├── styles.css           # Component styles
│   ├── README.md            # Component documentation
│   └── index.ts             # Public exports
├── hooks/
│   └── useVotingUnified.ts  # TanStack Query hooks
├── types/
│   └── unified.ts           # Type definitions & adapters
├── utils/
│   ├── accessibility.ts     # ARIA helpers, focus management
│   ├── performance.ts       # Prefetch, lazy load, virtual scroll
│   └── index.ts
├── unified/
│   ├── index.ts             # Unified exports
│   └── README.md            # API documentation
└── index.ts                 # Feature exports
```

## Быстрый старт

### Установка

Styles уже включены в общий bundle. Если нужно импортировать отдельно:

```tsx
import '@/features/voting/components/styles.css';
```

### Использование компонентов

```tsx
import {
  VotingCard,
  VotingList,
  NominationCard,
  VoteButton,
  ResultsVisualization,
  VotingAlerts,
  createVotingAlerts,
} from '@/features/voting/components';

import {
  useVotingSessions,
  useVotingSession,
  useCastVoteUnified,
} from '@/features/voting/hooks/useVotingUnified';
```

### Пример: Каталог голосований

```tsx
function VotingCatalog() {
  const navigate = useNavigate();
  const { data: votings, isLoading, error, refetch } = useVotingSessions();

  if (isLoading) {
    return <VotingListSkeleton count={6} />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <VotingList
      votings={votings}
      showFilters
      showSorting
      onVotingClick={(id) => navigate(`/votings/${id}`)}
    />
  );
}
```

### Пример: Голосование

```tsx
function VotingPage({ sessionId }: { sessionId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { data: session, isLoading } = useVotingSession(sessionId);
  const castVote = useCastVoteUnified();

  const handleVote = async () => {
    await castVote.mutateAsync({
      sessionId,
      questionId: session!.questions[0].id,
      nominationId: selected!,
    });
  };

  if (isLoading) return <PageHeaderSkeleton />;

  return (
    <div>
      <h1>{session?.title}</h1>
      
      {session?.questions[0]?.nominations?.map((nom) => (
        <NominationCard
          key={nom.id}
          nomination={nom}
          mode="single"
          isSelected={selected === nom.id}
          onSelect={setSelected}
        />
      ))}

      <Button
        view="action"
        disabled={!selected}
        loading={castVote.isPending}
        onClick={handleVote}
      >
        Проголосовать
      </Button>
    </div>
  );
}
```

## API Reference

### Unified API

Автоматически определяет legacy/modern API по формату ID:
- UUID → modern API (`/voting/polls`)
- Другой формат → legacy API (`/voting/nominations`)

```tsx
import { fetchVotingSessions, submitVote, detectApi } from '@/features/voting/api/unifiedApi';

// Auto-routing
const sessions = await fetchVotingSessions(); // Returns VotingSession[]
const result = await submitVote({ sessionId, questionId, nominationId });
```

### TanStack Query Hooks

| Hook | Purpose |
|------|---------|
| `useVotingSessions(filters?)` | Fetch all voting sessions |
| `useVotingSession(id)` | Fetch single session with questions |
| `useNominationDetail(id)` | Fetch nomination with options |
| `useCastVoteUnified()` | Submit vote (optimistic updates) |
| `useRevokeVoteUnified()` | Revoke vote (modern API only) |

### Query Keys

```tsx
import { votingKeysUnified } from '@/features/voting/hooks/useVotingUnified';

votingKeysUnified.all          // ['voting']
votingKeysUnified.sessions()   // ['voting', 'sessions', filters]
votingKeysUnified.session(id)  // ['voting', 'session', id]
votingKeysUnified.nomination(id) // ['voting', 'nomination', id]
```

## Миграция

### С legacy компонентов

```tsx
// Before
import { VotingCard } from '@/pages/HomePage/components/VotingCard';
<VotingCard item={decoratedVoting} nowTs={Date.now()} onOpen={fn} />

// After
import { VotingCard } from '@/features/voting/components';
<VotingCard voting={votingSession} onClick={fn} />
```

### С ручного fetching

```tsx
// Before
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);
useEffect(() => {
  setLoading(true);
  fetchVotingCatalog().then(setData).finally(() => setLoading(false));
}, []);

// After
const { data, isLoading, refetch } = useVotingSessions();
```

## Accessibility (A11y)

Все компоненты соответствуют WCAG 2.1 AA:

- **Keyboard Navigation**: Tab, Enter, Space, Arrow keys
- **Screen Readers**: ARIA labels, live regions, semantic HTML
- **Focus Management**: Focus trap в модалах, visible focus indicators
- **Reduced Motion**: Respects `prefers-reduced-motion`

```tsx
import {
  useFocusTrap,
  useRovingTabIndex,
  useAnnounce,
  usePrefersReducedMotion,
} from '@/features/voting/utils/accessibility';
```

## Performance

### Prefetching

```tsx
import { usePrefetchVotingSession } from '@/features/voting/utils/performance';

function VotingCard({ voting }) {
  const prefetch = usePrefetchVotingSession();

  return (
    <Card onMouseEnter={() => prefetch(voting.id)}>
      ...
    </Card>
  );
}
```

### Lazy Loading

```tsx
import { LazyResultsVisualization } from '@/features/voting/utils/performance';

<LazyResultsVisualization nominations={nominations} totalVotes={100} />
```

## Документация

- [Component Library](./components/README.md) — Props, примеры, best practices
- [API Integration](../../docs/voting-api-integration.md) — Hooks, error handling, caching
- [UX Specification](../../docs/voting-ux-specification.md) — User flows, design principles

## Roadmap

- [x] Phase 1: UX Research & Design System
- [x] Phase 2: Unified API Layer
- [x] Phase 3: Core Components
- [x] Phase 4: Page-Level Redesign
- [x] Phase 5: Advanced UX (Progressive Disclosure, Accessibility)
- [ ] Phase 6: Admin Interface Polish
- [ ] Phase 7: Testing & QA
- [ ] Phase 8: Documentation Finalization
