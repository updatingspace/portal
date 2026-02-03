---
sidebar_position: 2
title: Portal Frontend
description: Основное приложение платформы
---

# Portal Frontend

**Portal Frontend** — основное веб-приложение платформы.

- **Path**: `web/portal-frontend`
- **Dev port**: `5173`

## Функционал

| Module | Статус | Описание |
|--------|--------|----------|
| Voting | ✅ Production | Голосования, номинации, результаты |
| Events | ✅ MVP | Календарь, RSVP |
| Feed | ✅ MVP | Лента активности |
| Profile | ✅ MVP | Профиль пользователя |
| Communities | 🔶 Early | Сообщества (в разработке) |

## Структура

```
src/
├── app/                      # App initialization
│   ├── providers.tsx
│   └── routes.tsx
│
├── api/                      # API layer
│   └── client.ts
│
├── contexts/                 # Global contexts
│   ├── TenantContext.ts
│   ├── UserContext.ts
│   └── ModulesContext.ts
│
├── features/                 # Feature modules
│   ├── voting/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types/
│   ├── events/
│   ├── feed/
│   └── profile/
│
├── components/               # Shared UI
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Modal.tsx
│   └── layout/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── Footer.tsx
│
├── hooks/                    # Shared hooks
│   ├── useApi.ts
│   ├── useAuth.ts
│   └── useTenant.ts
│
├── pages/                    # Route pages
│   ├── Home.tsx
│   ├── VotingPage.tsx
│   ├── EventsPage.tsx
│   └── ProfilePage.tsx
│
├── types/                    # Shared types
│   └── api.ts
│
└── utils/                    # Utilities
    ├── date.ts
    └── format.ts
```

## Voting Module

### Components

```typescript
// features/voting/components/PollList.tsx

export function PollList() {
  const { polls, isLoading } = usePolls();
  
  if (isLoading) return <Loader />;
  
  return (
    <div className="poll-list">
      {polls.map(poll => (
        <PollCard key={poll.id} poll={poll} />
      ))}
    </div>
  );
}
```

```typescript
// features/voting/components/PollCard.tsx

interface PollCardProps {
  poll: Poll;
}

export function PollCard({ poll }: PollCardProps) {
  return (
    <Card>
      <Card.Header>
        <h3>{poll.title}</h3>
        <Badge variant={poll.status}>{poll.status}</Badge>
      </Card.Header>
      <Card.Body>
        <p>{poll.description}</p>
        {poll.ends_at && (
          <p className="text-muted">
            До: {formatDate(poll.ends_at)}
          </p>
        )}
      </Card.Body>
      <Card.Footer>
        <Link to={`/voting/${poll.id}`}>
          <Button>Голосовать</Button>
        </Link>
      </Card.Footer>
    </Card>
  );
}
```

```typescript
// features/voting/components/VoteForm.tsx

export function VoteForm({ poll }: { poll: Poll }) {
  const [votes, setVotes] = useState<Record<string, string>>({});
  const { mutate: castVote, isLoading } = useCastVote();
  
  const handleVote = (nominationId: string, optionId: string) => {
    setVotes(prev => ({ ...prev, [nominationId]: optionId }));
  };
  
  const handleSubmit = () => {
    Object.entries(votes).forEach(([nominationId, optionId]) => {
      castVote({ pollId: poll.id, nominationId, optionId });
    });
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {poll.nominations.map(nomination => (
        <NominationVote
          key={nomination.id}
          nomination={nomination}
          selectedOption={votes[nomination.id]}
          onSelect={optionId => handleVote(nomination.id, optionId)}
        />
      ))}
      <Button type="submit" disabled={isLoading}>
        Проголосовать
      </Button>
    </form>
  );
}
```

### Hooks

```typescript
// features/voting/hooks/usePolls.ts

export function usePolls(filters?: PollFilters) {
  return useQuery({
    queryKey: ["polls", filters],
    queryFn: () => votingApi.getPolls(filters),
  });
}
```

```typescript
// features/voting/hooks/useCastVote.ts

export function useCastVote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: votingApi.castVote,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(["polls", variables.pollId]);
      toast.success("Голос принят!");
    },
    onError: (error: ApiError) => {
      if (error.code === "ALREADY_VOTED") {
        toast.error("Вы уже голосовали в этой номинации");
      } else {
        toast.error("Ошибка при голосовании");
      }
    },
  });
}
```

### API

```typescript
// features/voting/api/votingApi.ts

export const votingApi = {
  async getPolls(filters?: PollFilters): Promise<Poll[]> {
    const params = new URLSearchParams(filters as any);
    return apiClient(`/voting/polls?${params}`);
  },
  
  async getPoll(id: string): Promise<Poll> {
    return apiClient(`/voting/polls/${id}`);
  },
  
  async castVote(data: CastVoteData): Promise<Vote> {
    return apiClient("/voting/votes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  
  async getResults(pollId: string): Promise<PollResults> {
    return apiClient(`/voting/polls/${pollId}/results`);
  },
};
```

## Events Module

```typescript
// features/events/components/EventCalendar.tsx

export function EventCalendar() {
  const [dateRange, setDateRange] = useState(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }));
  
  const { events, isLoading } = useEvents(dateRange);
  
  return (
    <div className="event-calendar">
      <CalendarHeader
        month={dateRange.from}
        onPrevMonth={() => setDateRange(prev => ({
          from: subMonths(prev.from, 1),
          to: subMonths(prev.to, 1),
        }))}
        onNextMonth={() => setDateRange(prev => ({
          from: addMonths(prev.from, 1),
          to: addMonths(prev.to, 1),
        }))}
      />
      <CalendarGrid events={events} />
    </div>
  );
}
```

## Feed Module

Activity Feed module обеспечивает работу с лентой активности.

### Структура модуля

```
src/
├── api/
│   └── activity.ts         # API клиент
├── types/
│   └── activity.ts         # TypeScript типы
├── hooks/
│   └── useActivity.ts      # React hooks
└── modules/feed/
    ├── pages/
    │   └── FeedPage.tsx    # Главная страница ленты
    └── components/
        ├── FeedItem.tsx        # Элемент ленты
        ├── FeedFilters.tsx     # Фильтры
        ├── UnreadBadge.tsx     # Счётчик непрочитанных
        └── AccountLinkCard.tsx # Карточка привязки
```

### Types

```typescript
// types/activity.ts

// Типы событий
type ActivityEventType =
  | 'vote.cast'
  | 'event.created'
  | 'event.rsvp.changed'
  | 'game.achievement'
  | 'game.playtime'
  | 'minecraft.session';

// Событие активности
interface ActivityEvent {
  id: number;
  tenantId: string;
  actorUserId: string | null;
  type: string;
  occurredAt: string;
  title: string;
  payloadJson: Record<string, unknown>;
  visibility: 'public' | 'community' | 'team' | 'private';
  scopeType: string;
  scopeId: string;
  sourceRef: string;
}

// Feed response с курсорной пагинацией
interface FeedResponseV2 {
  items: ActivityEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

// Привязка аккаунта
interface AccountLinkDetail {
  id: number;
  sourceType: 'steam' | 'minecraft' | 'discord';
  status: 'active' | 'pending' | 'disabled' | 'error';
  lastSyncAt: string | null;
  lastError: string | null;
}
```

### API Client

```typescript
// api/activity.ts

// Fetch feed with cursor pagination
export async function fetchFeedV2(params?: FeedParams): Promise<FeedResponseV2> {
  const query = buildFeedQuery(params);
  // Activity сервис возвращает snake_case, клиент маппит в camelCase
  return request<FeedResponseV2>(`/activity/v2/feed?${query}`);
}

// Get unread count
export async function fetchUnreadCount(): Promise<number> {
  const data = await request<{ count: number }>('/activity/feed/unread-count');
  return data.count;
}

```

### Hooks

```typescript
// hooks/useActivity.ts

// Infinite scroll feed
export function useFeedInfinite(params?: Omit<FeedParams, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: ['activity', 'feed', 'infinite', params],
    queryFn: ({ pageParam }) => fetchFeedV2({ ...params, cursor: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
  });
}

// Unread count with polling
export function useUnreadCount() {
  const query = useQuery({
    queryKey: ['activity', 'unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000,
  });

  return { count: query.data ?? 0 };
}
```

### Components

```typescript
// modules/feed/pages/FeedPage.tsx

export const FeedPage: React.FC = () => {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeedInfinite({ types: selectedTypes.join(','), limit: 20 });

  const { count: unreadCount } = useUnreadCount();
  const { mutate: markAsRead } = useMarkFeedAsRead();

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, fetchNextPage]);

  return (
    <div>
      <header>
        <h1>Activity Feed</h1>
        {unreadCount > 0 && (
          <Button onClick={() => markAsRead()}>
            Mark {unreadCount} as read
          </Button>
        )}
      </header>

      <FeedFilters
        selectedTypes={selectedTypes}
        onTypesChange={setSelectedTypes}
      />

      {items.map((item) => (
        <FeedItem key={item.id} item={item} />
      ))}

      <div ref={loadMoreRef}>
        {isFetchingNextPage && <Loader />}
      </div>
    </div>
  );
};
```

```typescript
// modules/feed/components/FeedItem.tsx

export const FeedItem: React.FC<{ item: ActivityEvent }> = ({ item }) => {
  const icon = getEventIcon(item.type);
  const label = EVENT_TYPE_LABELS[item.type] || item.type;

  return (
    <Card className="p-4 mb-3">
      <div className="flex gap-4">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-sm text-gray-500">
            {new Date(item.occurredAt).toLocaleString()}
            <Label size="xs">{label}</Label>
          </div>
          <h3 className="font-semibold">{item.title}</h3>
          {item.payloadJson && (
            <pre className="text-xs">{JSON.stringify(item.payloadJson)}</pre>
          )}
        </div>
      </div>
    </Card>
  );
};
```

```typescript
// modules/feed/components/UnreadBadge.tsx

export const UnreadBadge: React.FC<{ realtime?: boolean }> = ({ realtime }) => {
  const { count } = useUnreadCount({ realtime });
  
  if (count === 0) return null;
  
  return <Label theme="danger">{count > 99 ? '99+' : count}</Label>;
};
```

## Layout Components

```typescript
// components/layout/Header.tsx

export function Header() {
  const { user, logout } = useAuth();
  const tenant = useTenant();
  
  return (
    <header className="header">
      <div className="header-brand">
        <img src={tenant?.logo} alt={tenant?.name} />
        <span>{tenant?.name}</span>
      </div>
      
      <nav className="header-nav">
        <NavLink to="/voting">Голосования</NavLink>
        <NavLink to="/events">События</NavLink>
        <NavLink to="/feed">Лента</NavLink>
      </nav>
      
      <div className="header-user">
        {user ? (
          <Dropdown>
            <Dropdown.Toggle>
              <Avatar user={user} />
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item to="/profile">Профиль</Dropdown.Item>
              <Dropdown.Item onClick={logout}>Выйти</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        ) : (
          <Button onClick={() => window.location.href = "/api/bff/auth/login"}>
            Войти
          </Button>
        )}
      </div>
    </header>
  );
}
```

## Команды

```bash
# Разработка
cd web/portal-frontend
npm run dev

# Сборка
npm run build

# Тесты
npm run test

# Линтер
npm run lint
```
