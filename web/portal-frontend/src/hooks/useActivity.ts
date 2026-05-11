/**
 * Activity Service React Hooks
 *
 * Custom hooks для работы с Activity Service API.
 * Используют TanStack Query для кеширования и управления состоянием.
 *
 * @module hooks/useActivity
 */

import { useCallback, useState } from 'react';
import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchFeed,
  fetchFeedV2,
  fetchUnreadCount,
  markFeedAsRead,
  fetchAccountLinks,
  createAccountLink,
  deleteAccountLink,
  fetchSources,
  fetchSubscriptions,
  updateSubscriptions,
  createNews,
  fetchNews,
  listDraftNews,
} from '../api/activity';
import type {
  ActivityEvent,
  FeedParams,
  FeedResponseV2,
  AccountLinkCreatePayload,
  SubscriptionPayload,
  NewsPayload,
} from '../types/activity';
import { formatDate } from '@/shared/lib/formatters';

// ============================================================================
// Query Keys
// ============================================================================

export const activityKeys = {
  all: ['activity'] as const,
  feed: () => [...activityKeys.all, 'feed'] as const,
  feedList: (params?: FeedParams) => [...activityKeys.feed(), params] as const,
  feedInfinite: (params?: Omit<FeedParams, 'cursor'>) => [...activityKeys.feed(), 'infinite', params] as const,
  unreadCount: () => [...activityKeys.all, 'unread-count'] as const,
  accountLinks: () => [...activityKeys.all, 'account-links'] as const,
  sources: () => [...activityKeys.all, 'sources'] as const,
  subscriptions: () => [...activityKeys.all, 'subscriptions'] as const,
  news: () => [...activityKeys.all, 'news'] as const,
  newsById: (newsId: string) => [...activityKeys.news(), newsId] as const,
  drafts: () => [...activityKeys.news(), 'drafts'] as const,
};

// ============================================================================
// Feed Hooks
// ============================================================================

/**
 * Hook for fetching feed (legacy, single page)
 *
 * @deprecated Use useFeedInfinite for cursor pagination
 */
export function useFeed(params?: Omit<FeedParams, 'cursor'>) {
  return useQuery({
    queryKey: activityKeys.feedList(params),
    queryFn: () => fetchFeed(params),
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Hook for infinite scroll feed with cursor pagination
 *
 * @example
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetchingNextPage,
 * } = useFeedInfinite({ types: 'vote.cast', limit: 20 });
 *
 * // Flatten pages into items
 * const items = data?.pages.flatMap(page => page.items) ?? [];
 */
export function useFeedInfinite(
  params?: Omit<FeedParams, 'cursor'>,
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery({
    queryKey: activityKeys.feedInfinite(params),
    queryFn: ({ pageParam }) =>
      fetchFeedV2({
        ...params,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: FeedResponseV2) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for unread count.
 */
export function useUnreadCount() {
  const query = useQuery({
    queryKey: activityKeys.unreadCount(),
    queryFn: fetchUnreadCount,
    staleTime: 60_000, // 1 minute
    refetchInterval: 60_000,
  });

  return {
    count: query.data ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook for marking feed as read
 */
export function useMarkFeedAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markFeedAsRead,
    onSuccess: () => {
      queryClient.setQueryData(activityKeys.unreadCount(), 0);
    },
  });
}

/**
 * Hook for creating news posts
 */
export function useCreateNews() {
  return useMutation({
    mutationFn: (payload: {
      title?: string | null;
      body: string;
      tags?: string[];
      visibility: 'public' | 'community' | 'team' | 'private';
      status?: NewsPayload['status'];
      scopeType?: 'TENANT' | 'COMMUNITY' | 'TEAM';
      scopeId?: string | null;
      media?: NewsPayload['media'];
    }) =>
      createNews({
        title: payload.title ?? undefined,
        body: payload.body,
        tags: payload.tags ?? [],
        visibility: payload.visibility,
        status: payload.status ?? 'published',
        scope_type: payload.scopeType,
        scope_id: payload.scopeId ?? undefined,
        media: payload.media ?? [],
      }),
  });
}

export function useNews(newsId: string | null | undefined) {
  return useQuery({
    queryKey: newsId ? activityKeys.newsById(newsId) : [...activityKeys.news(), 'missing'],
    queryFn: () => fetchNews(newsId!),
    enabled: Boolean(newsId),
    staleTime: 10_000,
  });
}

export function useDraftNews(limit = 20, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...activityKeys.drafts(), limit] as const,
    queryFn: () => listDraftNews(limit),
    enabled: options?.enabled ?? true,
    staleTime: 10_000,
  });
}

// ============================================================================
// Account Links Hooks
// ============================================================================

/**
 * Hook for fetching user's account links
 */
export function useAccountLinks() {
  return useQuery({
    queryKey: activityKeys.accountLinks(),
    queryFn: fetchAccountLinks,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

/**
 * Hook for creating account link
 *
 * @example
 * const { mutate: linkAccount } = useCreateAccountLink();
 *
 * linkAccount({
 *   sourceId: steamSourceId,
 *   settingsJson: { steam_id: '76561198012345678' },
 * });
 */
export function useCreateAccountLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AccountLinkCreatePayload) => createAccountLink(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.accountLinks() });
    },
  });
}

/**
 * Hook for deleting account link
 */
export function useDeleteAccountLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: number) => deleteAccountLink(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.accountLinks() });
    },
  });
}

// ============================================================================
// Sources Hooks
// ============================================================================

/**
 * Hook for fetching available sources
 */
export function useSources() {
  return useQuery({
    queryKey: activityKeys.sources(),
    queryFn: fetchSources,
    staleTime: 10 * 60_000, // 10 minutes (sources rarely change)
  });
}

// ============================================================================
// Subscriptions Hooks
// ============================================================================

/**
 * Hook for fetching user's subscriptions
 */
export function useSubscriptions() {
  return useQuery({
    queryKey: activityKeys.subscriptions(),
    queryFn: fetchSubscriptions,
    staleTime: 5 * 60_000,
  });
}

/**
 * Hook for updating subscriptions
 */
export function useUpdateSubscriptions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SubscriptionPayload) => updateSubscriptions(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.subscriptions() });
      // Feed will change based on subscriptions
      queryClient.invalidateQueries({ queryKey: activityKeys.feed() });
    },
  });
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook for filtering feed items by type
 *
 * @example
 * const { items, setTypeFilter, activeTypes } = useFeedFilter();
 */
export function useFeedFilter() {
  const [activeTypes, setActiveTypes] = useState<string[]>([]);

  const typesParam = activeTypes.length > 0 ? activeTypes.join(',') : undefined;

  const { data, ...rest } = useFeedInfinite({ types: typesParam });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const setTypeFilter = useCallback((types: string[]) => {
    setActiveTypes(types);
  }, []);

  const toggleType = useCallback((type: string) => {
    setActiveTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }, []);

  return {
    items,
    activeTypes,
    setTypeFilter,
    toggleType,
    ...rest,
  };
}

/**
 * Get unique event types from feed items
 */
export function getUniqueEventTypes(items: ActivityEvent[]): string[] {
  const types = new Set(items.map((item) => item.type));
  return Array.from(types).sort();
}

/**
 * Group feed items by date
 */
export function groupFeedByDate(items: ActivityEvent[]): Map<string, ActivityEvent[]> {
  const groups = new Map<string, ActivityEvent[]>();

  items.forEach((item) => {
    const parsed = new Date(item.occurredAt);
    const date = Number.isNaN(parsed.getTime()) ? 'Без даты' : formatDate(parsed);
    const existing = groups.get(date) ?? [];
    groups.set(date, [...existing, item]);
  });

  return groups;
}
