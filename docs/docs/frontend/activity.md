---
sidebar_position: 4
title: Activity Frontend
description: Документация frontend модуля Activity Feed
---

# Activity Frontend Module

Документация frontend части для работы с Activity Service.

## Обзор

Activity Frontend Module предоставляет:
- TypeScript типы синхронизированные с backend
- API клиент для всех endpoints Activity сервиса
- React hooks с TanStack Query
- UI компоненты для ленты и фильтров

## Структура файлов

```
web/portal-frontend/src/
├── types/
│   └── activity.ts           # Полные TypeScript типы
├── api/
│   └── activity.ts           # API клиент
├── hooks/
│   └── useActivity.ts        # React hooks
└── modules/feed/
    ├── pages/
    │   └── FeedPage.tsx      # Страница ленты
    └── components/
        ├── index.ts
        ├── FeedItem.tsx      # Элемент ленты
        ├── FeedFilters.tsx   # Компонент фильтров
        ├── UnreadBadge.tsx   # Бейдж непрочитанных
        └── AccountLinkCard.tsx # Карточка привязки
```

## TypeScript Типы

### Основные типы

```typescript
// types/activity.ts

// Типы источников
type SourceType = 'steam' | 'minecraft' | 'discord' | 'custom';

// Типы событий
type ActivityEventType =
  | 'vote.cast'
  | 'event.created'
  | 'event.rsvp.changed'
  | 'post.created'
  | 'news.posted'
  // Коннекторы (могут быть недоступны без включения на бэке)
  | 'game.achievement'
  | 'game.playtime'
  | 'steam.private'
  | 'minecraft.session';

// Событие активности
interface ActivityEvent {
  id: number;
  tenantId: string;
  actorUserId: string | null;
  targetUserId: string | null;
  type: string;
  occurredAt: string;
  title: string;
  payloadJson: Record<string, unknown>;
  visibility: 'public' | 'community' | 'team' | 'private';
  scopeType: string;
  scopeId: string;
  sourceRef: string;
}
```

### Response типы

```typescript
// Legacy feed response
interface FeedResponse {
  items: ActivityEvent[];
}

// V2 feed response с курсорной пагинацией
interface FeedResponseV2 {
  items: ActivityEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

// Unread count
interface UnreadCountResponse {
  count: number;
}
```

### Account Links типы

```typescript
type AccountLinkStatus = 'active' | 'pending' | 'disabled' | 'error';

interface AccountLink {
  id: number;
  tenantId: string;
  userId: string;
  sourceId: number;
  status: AccountLinkStatus;
  settingsJson: Record<string, unknown>;
  externalIdentityRef: string | null;
}

interface AccountLinkDetail extends AccountLink {
  sourceType: SourceType;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
}
```

## API Клиент

### Feed API

> Примечание: Activity сервис возвращает `snake_case` поля. Клиент `api/activity.ts`
> маппит их в `camelCase` для `ActivityEvent` и `FeedResponseV2`.

```typescript
import { fetchFeed, fetchFeedV2, fetchUnreadCount } from '@/api/activity';

// Legacy feed (offset-based) - deprecated
const items = await fetchFeed({ limit: 50, types: 'vote.cast' });

// V2 feed with cursor pagination
const { items, nextCursor, hasMore } = await fetchFeedV2({
  limit: 20,
  cursor: prevCursor,
  types: 'vote.cast,event.created',
});

// Важно: если передать неизвестные типы, API вернёт 400 INVALID_EVENT_TYPES.

// Get unread count
const count = await fetchUnreadCount();

// Mark feed as read
await markFeedAsRead();
```

### Account Links API

```typescript
import {
  fetchAccountLinks,
  createAccountLink,
  deleteAccountLink,
} from '@/api/activity';

// Get user's account links
const links = await fetchAccountLinks();

// Link Steam account
const link = await createAccountLink({
  sourceId: steamSourceId,
  settingsJson: { steam_id: '76561198012345678' },
});

// Disconnect
await deleteAccountLink(link.id);
```


## React Hooks

### Query Keys

```typescript
export const activityKeys = {
  all: ['activity'] as const,
  feed: () => [...activityKeys.all, 'feed'] as const,
  feedList: (params) => [...activityKeys.feed(), params] as const,
  feedInfinite: (params) => [...activityKeys.feed(), 'infinite', params] as const,
  unreadCount: () => [...activityKeys.all, 'unread-count'] as const,
  accountLinks: () => [...activityKeys.all, 'account-links'] as const,
  sources: () => [...activityKeys.all, 'sources'] as const,
  subscriptions: () => [...activityKeys.all, 'subscriptions'] as const,
};
```

### useFeedInfinite

Infinite scroll для ленты с курсорной пагинацией.

```typescript
import { useFeedInfinite } from '@/hooks/useActivity';

function FeedList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useFeedInfinite({ types: 'vote.cast', limit: 20 });

  // Flatten pages
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div>
      {items.map((item) => (
        <FeedItem key={item.id} item={item} />
      ))}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
```

### useUnreadCount

Счётчик непрочитанных с периодическим polling обновлением.

```typescript
import { useUnreadCount } from '@/hooks/useActivity';

function Header() {
  const { count, isLoading } = useUnreadCount();

  return (
    <nav>
      <Link to="/feed">
        Feed {count > 0 && <Badge>{count}</Badge>}
      </Link>
    </nav>
  );
}
```

### useMarkFeedAsRead

Mutation для пометки ленты как прочитанной.

```typescript
import { useMarkFeedAsRead } from '@/hooks/useActivity';

function FeedHeader({ unreadCount }) {
  const { mutate: markAsRead, isPending } = useMarkFeedAsRead();

  return (
    <button onClick={() => markAsRead()} disabled={isPending}>
      Mark {unreadCount} as read
    </button>
  );
}
```

### News (создание)

```typescript
import { requestNewsMediaUpload, uploadNewsMediaFile, createNews } from '@/api/activity';

// 1) получить upload URL
const upload = await requestNewsMediaUpload({
  filename: file.name,
  content_type: file.type,
  size_bytes: file.size,
});

// 2) загрузить в S3
await uploadNewsMediaFile(upload.upload_url, upload.upload_headers, file);

// 3) создать новость
await createNews({
  title: 'Patch notes',
  body: 'Мы выкатили обновление...',
  tags: ['patch', 'servers'],
  visibility: 'public',
  scope_type: 'TENANT',
  media: [
    {
      type: 'image',
      key: upload.key,
      content_type: file.type,
      size_bytes: file.size,
    },
  ],
});
```

### News (реакции и комментарии)

```typescript
import { reactToNews, createNewsComment } from '@/api/activity';

await reactToNews(newsId, { emoji: '🔥', action: 'add' });
await createNewsComment(newsId, 'Круто!');
```

### useAccountLinks

Управление привязками аккаунтов.

```typescript
import {
  useAccountLinks,
  useCreateAccountLink,
  useDeleteAccountLink,
} from '@/hooks/useActivity';

function AccountSettings() {
  const { data: links = [], isLoading } = useAccountLinks();
  const { mutate: createLink } = useCreateAccountLink();
  const { mutate: deleteLink } = useDeleteAccountLink();

  const handleLinkSteam = (steamId: string) => {
    createLink({
      sourceId: STEAM_SOURCE_ID,
      settingsJson: { steam_id: steamId },
    });
  };

  return (
    <div>
      {links.map((link) => (
        <AccountLinkCard
          key={link.id}
          link={link}
          onDisconnect={() => deleteLink(link.id)}
        />
      ))}
      <button onClick={() => handleLinkSteam('...')}>
        Link Steam
      </button>
    </div>
  );
}
```

## UI Компоненты

### FeedPage

Главная страница ленты с infinite scroll и фильтрами.

```tsx
import { FeedPage } from '@/modules/feed/pages/FeedPage';

// В роутере
<Route path="/app/feed" element={<FeedPage />} />
```

Features:
- Infinite scroll с Intersection Observer
- Фильтрация по типам событий
- Polling unread count
- Mark all as read

### FeedItem

Отображение одного события.

```tsx
import { FeedItem } from '@/modules/feed/components';

<FeedItem
  item={activityEvent}
  showPayload={true}      // Показывать payload
  compact={false}         // Компактный режим
  onClick={(item) => {}}  // Обработчик клика
/>
```

### FeedFilters

Компонент фильтров.

```tsx
import { FeedFilters } from '@/modules/feed/components';

<FeedFilters
  selectedTypes={['vote.cast', 'event.created']}
  onTypesChange={(types) => setSelectedTypes(types)}
  fromDate={startDate}
  toDate={endDate}
  onFromDateChange={setStartDate}
  onToDateChange={setEndDate}
  onReset={() => resetFilters()}
/>
```

### UnreadBadge

Бейдж с количеством непрочитанных.

```tsx
import { UnreadBadge, UnreadDot } from '@/modules/feed/components';

// Полный бейдж
<UnreadBadge size="s" />

// Простой индикатор
<UnreadDot />
```

### AccountLinkCard

Карточка привязанного аккаунта.

```tsx
import { AccountLinkCard, AccountLinkList } from '@/modules/feed/components';

// Одна карточка
<AccountLinkCard
  link={accountLinkDetail}
  onSync={(id) => triggerSync(id)}
  onDisconnect={(id) => deleteLink(id)}
  isLoading={isSyncing}
/>

// Список с empty state
<AccountLinkList
  links={accountLinks}
  onSync={handleSync}
  onDisconnect={handleDisconnect}
  onConnect={() => openConnectDialog()}
/>
```

## Интеграция в Navigation

Добавление бейджа в навигацию:

```tsx
// features/navigation/menu.tsx
import { UnreadBadge } from '@/modules/feed/components';

export const menuItems = [
  {
    id: 'feed',
    title: 'Activity Feed',
    route: '/app/feed',
    icon: ActivityIcon,
    badge: <UnreadBadge size="xs" />,
  },
];
```

## Стилизация

Компоненты используют:
- Tailwind CSS для стилей
- Gravity UI для базовых компонентов
- CSS variables для темы

```css
/* Кастомные стили если нужны */
.feed-item {
  @apply p-4 mb-3 rounded-lg bg-white dark:bg-gray-800;
  @apply hover:shadow-md transition-shadow;
}

.feed-item-compact {
  @apply py-2 px-3;
}
```

## Тестирование

```typescript
// tests/hooks/useActivity.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useFeedInfinite, useUnreadCount } from '@/hooks/useActivity';

describe('useFeedInfinite', () => {
  it('fetches first page', async () => {
    const { result } = renderHook(() => useFeedInfinite({ limit: 10 }));
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    
    expect(result.current.data?.pages[0].items).toHaveLength(10);
  });

  it('fetches next page on demand', async () => {
    const { result } = renderHook(() => useFeedInfinite({ limit: 10 }));
    
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    
    result.current.fetchNextPage();
    
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
  });
});
```

## Миграция

### С legacy API на V2

```typescript
// До (legacy)
const items = await fetchFeed({ limit: 50 });

// После (v2 с пагинацией)
const { items, nextCursor, hasMore } = await fetchFeedV2({ limit: 50 });

// Для следующей страницы
const nextPage = await fetchFeedV2({ limit: 50, cursor: nextCursor });
```

### Обновление типов

```typescript
// Старый тип
interface ActivityItem {
  id: number;
  payload?: Record<string, unknown>;
}

// Новый тип
interface ActivityEvent {
  id: number;
  payloadJson: Record<string, unknown>;  // Переименовано
  visibility: EventVisibility;            // Добавлено
  scopeType: string;                      // Добавлено
}
```

## См. также

- [Activity Service Overview](../services/activity/overview.md)
- [Activity API Reference](../services/activity/api-reference.md)
- [Portal Frontend](./portal.md)
