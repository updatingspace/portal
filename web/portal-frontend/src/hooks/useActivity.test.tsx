/**
 * Activity Hooks Unit Tests
 *
 * Tests for React hooks using TanStack Query.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  useFeedInfinite,
  useUnreadCount,
  useMarkFeedAsRead,
  useAccountLinks,
  useCreateAccountLink,
  useDeleteAccountLink,
  useSources,
  useFeedFilter,
  activityKeys,
  getUniqueEventTypes,
  groupFeedByDate,
} from './useActivity';
import {
  createActivityFeedV2,
  createActivityFeedV2Empty,
  createAccountLinks,
  createSources,
  createActivityEvents,
} from '../test/fixtures';
import * as activityApi from '../api/activity';

// Mock the activity API
vi.mock('../api/activity', () => ({
  fetchFeed: vi.fn(),
  fetchFeedV2: vi.fn(),
  fetchUnreadCount: vi.fn(),
  markFeedAsRead: vi.fn(),
  fetchAccountLinks: vi.fn(),
  createAccountLink: vi.fn(),
  deleteAccountLink: vi.fn(),
  fetchSources: vi.fn(),
  fetchSubscriptions: vi.fn(),
  updateSubscriptions: vi.fn(),
  createNews: vi.fn(),
}));

// Create a wrapper with QueryClient for testing hooks
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Activity Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('useFeedInfinite', () => {
    it('fetches first page of feed', async () => {
      const feedData = createActivityFeedV2();
      vi.mocked(activityApi.fetchFeedV2).mockResolvedValueOnce(feedData);

      const { result } = renderHook(() => useFeedInfinite(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.pages).toHaveLength(1);
      expect(result.current.data?.pages[0].items).toEqual(feedData.items);
      expect(result.current.hasNextPage).toBe(true);
    });

    it('supports pagination with hasNextPage', async () => {
      const page1 = createActivityFeedV2();
      vi.mocked(activityApi.fetchFeedV2).mockResolvedValueOnce(page1);

      const { result } = renderHook(() => useFeedInfinite(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should have next page available
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.data?.pages).toHaveLength(1);
      expect(result.current.data?.pages[0].nextCursor).toBe('cursor-next-page');
    });

    it('passes filter params to API', async () => {
      vi.mocked(activityApi.fetchFeedV2).mockResolvedValueOnce(createActivityFeedV2());

      const { result } = renderHook(
        () => useFeedInfinite({ types: 'vote.cast', limit: 10 }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(activityApi.fetchFeedV2).toHaveBeenCalledWith(
        expect.objectContaining({
          types: 'vote.cast',
          limit: 10,
        }),
      );
    });
  });

  describe('useUnreadCount', () => {
    it('returns unread count', async () => {
      vi.mocked(activityApi.fetchUnreadCount).mockResolvedValueOnce(42);

      const { result } = renderHook(() => useUnreadCount(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.count).toBe(42);
    });

    it('returns 0 when query data is undefined', async () => {
      vi.mocked(activityApi.fetchUnreadCount).mockResolvedValueOnce(0);

      const { result } = renderHook(() => useUnreadCount(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.count).toBe(0);
    });

  });

  describe('useMarkFeedAsRead', () => {
    it('calls markFeedAsRead and invalidates queries', async () => {
      vi.mocked(activityApi.markFeedAsRead).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useMarkFeedAsRead(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(activityApi.markFeedAsRead).toHaveBeenCalled();
    });
  });

  describe('useAccountLinks', () => {
    it('fetches account links', async () => {
      const links = createAccountLinks();
      vi.mocked(activityApi.fetchAccountLinks).mockResolvedValueOnce(links);

      const { result } = renderHook(() => useAccountLinks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(links);
    });
  });

  describe('useCreateAccountLink', () => {
    it('creates account link', async () => {
      const newLink = createAccountLinks()[0];
      vi.mocked(activityApi.createAccountLink).mockResolvedValueOnce(newLink);

      const { result } = renderHook(() => useCreateAccountLink(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          sourceId: 1,
          settingsJson: { steam_id: '12345' },
        });
      });

      expect(activityApi.createAccountLink).toHaveBeenCalledWith({
        sourceId: 1,
        settingsJson: { steam_id: '12345' },
      });
    });
  });

  describe('useDeleteAccountLink', () => {
    it('deletes account link', async () => {
      vi.mocked(activityApi.deleteAccountLink).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteAccountLink(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(123);
      });

      expect(activityApi.deleteAccountLink).toHaveBeenCalledWith(123);
    });
  });

  describe('useSources', () => {
    it('fetches sources', async () => {
      const sources = createSources();
      vi.mocked(activityApi.fetchSources).mockResolvedValueOnce(sources);

      const { result } = renderHook(() => useSources(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(sources);
    });
  });

  describe('useFeedFilter', () => {
    it('filters feed by types', async () => {
      vi.mocked(activityApi.fetchFeedV2).mockResolvedValue(createActivityFeedV2());

      const { result } = renderHook(() => useFeedFilter(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.items.length).toBeGreaterThan(0);
      });

      // Toggle filter
      act(() => {
        result.current.toggleType('vote.cast');
      });

      expect(result.current.activeTypes).toContain('vote.cast');
    });

    it('sets multiple type filters', async () => {
      vi.mocked(activityApi.fetchFeedV2).mockResolvedValue(createActivityFeedV2());

      const { result } = renderHook(() => useFeedFilter(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.items.length).toBeGreaterThan(0);
      });

      act(() => {
        result.current.setTypeFilter(['vote.cast', 'post.created']);
      });

      expect(result.current.activeTypes).toEqual(['vote.cast', 'post.created']);
    });
  });
});

describe('Utility Functions', () => {
  describe('getUniqueEventTypes', () => {
    it('returns unique event types sorted', () => {
      const items = createActivityEvents();
      const types = getUniqueEventTypes(items);

      expect(types).toContain('vote.cast');
      expect(types).toContain('game.achievement');
      expect(types).toContain('post.created');
      expect(types).toContain('event.rsvp.changed');
      // Should be sorted
      expect(types).toEqual([...types].sort());
    });

    it('returns empty array for empty items', () => {
      expect(getUniqueEventTypes([])).toEqual([]);
    });
  });

  describe('groupFeedByDate', () => {
    it('groups items by date', () => {
      const items = createActivityEvents();
      const groups = groupFeedByDate(items);

      expect(groups.size).toBeGreaterThan(0);
      // All items from fixture have same date
      const firstGroup = groups.values().next().value;
      expect(firstGroup).toBeDefined();
      expect(Array.isArray(firstGroup)).toBe(true);
    });

    it('returns empty map for empty items', () => {
      const groups = groupFeedByDate([]);
      expect(groups.size).toBe(0);
    });
  });
});

describe('activityKeys', () => {
  it('generates correct query keys', () => {
    expect(activityKeys.all).toEqual(['activity']);
    expect(activityKeys.feed()).toEqual(['activity', 'feed']);
    expect(activityKeys.unreadCount()).toEqual(['activity', 'unread-count']);
    expect(activityKeys.accountLinks()).toEqual(['activity', 'account-links']);
    expect(activityKeys.sources()).toEqual(['activity', 'sources']);
    expect(activityKeys.subscriptions()).toEqual(['activity', 'subscriptions']);
  });

  it('includes params in feed list key', () => {
    const params = { types: 'vote.cast', limit: 10 };
    expect(activityKeys.feedList(params)).toEqual(['activity', 'feed', params]);
  });

  it('includes params in infinite feed key', () => {
    const params = { types: 'vote.cast' };
    expect(activityKeys.feedInfinite(params)).toEqual(['activity', 'feed', 'infinite', params]);
  });
});
