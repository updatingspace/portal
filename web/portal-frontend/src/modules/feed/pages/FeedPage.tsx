import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader, Card, Button, Select, Label } from '@gravity-ui/uikit';

import { useFeedInfinite, useUnreadCount, useMarkFeedAsRead, getUniqueEventTypes, groupFeedByDate } from '../../../hooks/useActivity';
import type { ActivityEvent } from '../../../types/activity';
import { SkeletonBlock } from '../../../shared/ui/skeleton/SkeletonBlock';
import { SkeletonList } from '../../../shared/ui/skeleton/SkeletonList';

// Event type labels for UI
const EVENT_TYPE_LABELS: Record<string, string> = {
  'vote.cast': '🗳️ Голосование',
  'event.created': '📅 Событие создано',
  'event.rsvp.changed': '✅ RSVP изменён',
  'post.created': '📝 Пост создан',
  'game.achievement': '🏆 Достижение',
  'game.playtime': '🎮 Игровое время',
  'steam.private': '🔒 Steam приватный',
  'minecraft.session': '⛏️ Minecraft сессия',
};

// Icon mapping for event types
const getEventIcon = (type: string): string => {
  if (type.includes('vote')) return '🗳️';
  if (type.includes('event')) return '📅';
  if (type.includes('game') || type.includes('steam') || type.includes('minecraft')) return '🎮';
  if (type.includes('post')) return '📝';
  return '📌';
};

export const FeedPage: React.FC = () => {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Build types param
  const typesParam = selectedTypes.length > 0 ? selectedTypes.join(',') : undefined;

  // Infinite query for feed
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useFeedInfinite({ types: typesParam, limit: 20 });

  // Unread count with real-time updates
  const { count: unreadCount } = useUnreadCount({ realtime: true });

  // Mark as read mutation
  const { mutate: markAsRead, isPending: isMarkingRead } = useMarkFeedAsRead();

  // Flatten pages into items
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  // Get unique types for filter
  const availableTypes = getUniqueEventTypes(items);

  // Group by date for display
  const groupedItems = groupFeedByDate(items);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle filter change
  const handleTypeFilterChange = useCallback((values: string[]) => {
    setSelectedTypes(values);
  }, []);

  // Render single feed item
  const renderItem = (item: ActivityEvent) => {
    const dateStr = new Date(item.occurredAt).toLocaleString();
    const icon = getEventIcon(item.type);
    const typeLabel = EVENT_TYPE_LABELS[item.type] || item.type;

    return (
      <Card key={item.id} className="p-4 mb-3 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-4">
          <div className="text-2xl mt-1">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <span>{dateStr}</span>
              <span>•</span>
              <Label theme="info" size="xs">{typeLabel}</Label>
              {item.scopeType && (
                <>
                  <span>•</span>
                  <span className="text-xs">{item.scopeType}</span>
                </>
              )}
            </div>
            <h3 className="font-semibold text-lg truncate">{item.title}</h3>
            {item.payloadJson && Object.keys(item.payloadJson).length > 0 && (
              <div className="mt-2 text-sm text-gray-600 bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-auto max-h-32">
                <pre className="whitespace-pre-wrap text-xs">
                  {JSON.stringify(item.payloadJson, null, 2)}
                </pre>
              </div>
            )}
            {item.sourceRef && (
              <div className="mt-1 text-xs text-gray-400">
                Source: {item.sourceRef}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // Loading state
  if (isLoading && !items.length) {
    return (
      <div className="container py-4 max-w-2xl mx-auto">
        <div className="mb-6">
          <SkeletonBlock height={32} width="40%" />
        </div>
        <SkeletonList rows={4} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container py-4 max-w-2xl mx-auto">
        <div className="p-8 text-center text-red-500 bg-red-50 rounded">
          Failed to load feed. <Button view="flat" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Activity Feed</h1>
          {unreadCount > 0 && (
            <Label theme="danger" size="s">
              {unreadCount} new
            </Label>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            view="outlined"
            size="m"
            loading={isMarkingRead}
            onClick={() => markAsRead()}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filters */}
      {availableTypes.length > 0 && (
        <div className="mb-4">
          <Select
            multiple
            filterable
            placeholder="Filter by event type..."
            value={selectedTypes}
            onUpdate={handleTypeFilterChange}
            options={availableTypes.map((type) => ({
              value: type,
              content: EVENT_TYPE_LABELS[type] || type,
            }))}
            width="max"
          />
        </div>
      )}

      {/* Feed list */}
      {!items.length ? (
        <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded">
          {selectedTypes.length > 0
            ? 'No events matching your filters.'
            : 'Nothing happening yet.'}
        </div>
      ) : (
        <div className="feed-list">
          {Array.from(groupedItems.entries()).map(([date, dateItems]) => (
            <div key={date} className="mb-6">
              <div className="text-sm font-medium text-gray-500 mb-2 sticky top-0 bg-white dark:bg-gray-900 py-1">
                {date}
              </div>
              {dateItems.map(renderItem)}
            </div>
          ))}
        </div>
      )}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="py-4 flex justify-center">
        {isFetchingNextPage && <Loader size="m" />}
        {!hasNextPage && items.length > 0 && (
          <div className="text-sm text-gray-400">No more events</div>
        )}
      </div>
    </div>
  );
};
