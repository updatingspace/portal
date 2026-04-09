import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { activityKeys } from '../../hooks/useActivity';
import type { ActivityEvent, FeedResponseV2 } from '../../types/activity';

const getEventNewsId = (item: ActivityEvent): string | null => {
  const value = item.payloadJson?.news_id;
  return typeof value === 'string' && value ? value : null;
};

const sameFeedItem = (left: ActivityEvent, right: ActivityEvent) => {
  const leftNewsId = getEventNewsId(left);
  const rightNewsId = getEventNewsId(right);
  if (leftNewsId && rightNewsId) return leftNewsId === rightNewsId;
  return left.id === right.id;
};

const mergeItems = (
  items: ActivityEvent[],
  nextItem: ActivityEvent,
  options: { prependIfMissing: boolean },
) => {
  const { prependIfMissing } = options;
  let replaced = false;
  const merged = items.map((item) => {
    if (!sameFeedItem(item, nextItem)) return item;
    replaced = true;
    return nextItem;
  });
  if (!replaced && prependIfMissing) {
    return [nextItem, ...merged];
  }
  return merged;
};

export const patchActivityFeedCaches = (
  queryClient: QueryClient,
  updater: (item: ActivityEvent) => ActivityEvent | null,
) => {
  const queries = queryClient.getQueryCache().findAll({ queryKey: activityKeys.feed() });
  for (const query of queries) {
    const data = query.state.data as
      | InfiniteData<FeedResponseV2, unknown>
      | ActivityEvent[]
      | undefined;
    if (!data) continue;

    if (Array.isArray(data)) {
      queryClient.setQueryData<ActivityEvent[] | undefined>(query.queryKey, (current) =>
        current
          ?.map((item) => updater(item))
          .filter((item): item is ActivityEvent => item !== null),
      );
      continue;
    }

    if ('pages' in data) {
      queryClient.setQueryData<InfiniteData<FeedResponseV2, unknown> | undefined>(query.queryKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items
              .map((item) => updater(item))
              .filter((item): item is ActivityEvent => item !== null),
          })),
        };
      });
    }
  }
};

export const upsertFeedItem = (
  queryClient: QueryClient,
  nextItem: ActivityEvent,
  options: { prependIfMissing?: boolean } = {},
) => {
  const prependIfMissing = options.prependIfMissing ?? false;
  const queries = queryClient.getQueryCache().findAll({ queryKey: activityKeys.feed() });
  for (const query of queries) {
    const data = query.state.data as InfiniteData<FeedResponseV2, unknown> | ActivityEvent[] | undefined;
    if (!data) continue;

    if (Array.isArray(data)) {
      queryClient.setQueryData<ActivityEvent[] | undefined>(query.queryKey, (current) =>
        current ? mergeItems(current, nextItem, { prependIfMissing }) : current,
      );
      continue;
    }

    if ('pages' in data) {
      queryClient.setQueryData<InfiniteData<FeedResponseV2, unknown> | undefined>(query.queryKey, (current) => {
        if (!current || current.pages.length === 0) return current;
        let inserted = false;
        const pages = current.pages.map((page, index) => {
          const updated = mergeItems(page.items, nextItem, {
            prependIfMissing: !inserted && prependIfMissing && index === 0,
          });
          if (updated !== page.items && updated[0] === nextItem) {
            inserted = true;
          }
          if (!inserted && page.items.some((item) => sameFeedItem(item, nextItem))) {
            inserted = true;
          }
          return {
            ...page,
            items: updated,
          };
        });
        if (!inserted && prependIfMissing) {
          pages[0] = {
            ...pages[0],
            items: [nextItem, ...pages[0].items],
          };
        }
        return { ...current, pages };
      });
    }
  }

  const newsId = getEventNewsId(nextItem);
  if (newsId) {
    queryClient.setQueryData(activityKeys.newsById(newsId), nextItem);
  }
};

export const removeFeedNews = (queryClient: QueryClient, newsId: string) => {
  patchActivityFeedCaches(queryClient, (item) => (getEventNewsId(item) === newsId ? null : item));
  queryClient.removeQueries({ queryKey: activityKeys.newsById(newsId) });
};

export const upsertDraftItem = (queryClient: QueryClient, nextItem: ActivityEvent) => {
  const newsId = getEventNewsId(nextItem);
  queryClient.setQueriesData<ActivityEvent[] | undefined>(
    { queryKey: activityKeys.drafts() },
    (current) => {
      if (!current) return [nextItem];
      const next = mergeItems(current, nextItem, { prependIfMissing: true });
      return next.filter((item) => (getEventNewsId(item) ?? '') !== '');
    },
  );
  if (newsId) {
    queryClient.setQueryData(activityKeys.newsById(newsId), nextItem);
  }
};

export const removeDraftItem = (queryClient: QueryClient, newsId: string) => {
  queryClient.setQueriesData<ActivityEvent[] | undefined>(
    { queryKey: activityKeys.drafts() },
    (current) => current?.filter((item) => getEventNewsId(item) !== newsId),
  );
};
