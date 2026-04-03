/**
 * Activity Hooks Unit Tests
 *
 * Tests for React hooks using TanStack Query.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

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
  createAccountLinks,
  createSources,
  createActivityEvents,
} from '../test/fixtures';
import { TEST_ACTIVITY_VALUES } from '../test/constants';
import * as activityApi from '../api/activity';
import { createQueryClientWrapper } from '../test/queryClient';

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

const FEED_FILTER_TYPES = ['vote.cast', 'post.created'];
const FEED_FILTER_PARAMS = { types: 'vote.cast', limit: 10 };

function createWrapper() {
  return createQueryClientWrapper();
}

function renderActivityHook<TResult>(hook: () => TResult) {
  return renderHook(hook, {
    wrapper: createWrapper(),
  });
}

describe('Activity Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useFeedInfinite', () => {
    it('fetches first page of feed', async () => {
      const feedData = createActivityFeedV2();
      vi.mocked(activityApi.fetchFeedV2).mockResolvedValueOnce(feedData);

      const { result } = renderActivityHook(() => useFeedInfinite());

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

      const { result } = renderActivityHook(() => useFeedInfinite());

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

      const { result } = renderActivityHook(
        () => useFeedInfinite({ types: 'vote.cast', limit: 10 }),
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
    it.each([
      ['API unread count', TEST_ACTIVITY_VALUES.unreadCount],
      ['empty unread count', 0],
    ])('returns %s from query result', async (_name, unreadCount) => {
      vi.mocked(activityApi.fetchUnreadCount).mockResolvedValueOnce(unreadCount);

      const { result } = renderActivityHook(() => useUnreadCount());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.count).toBe(unreadCount);
    });
  });

  describe('useMarkFeedAsRead', () => {
    it('marks feed as read and reports success', async () => {
      vi.mocked(activityApi.markFeedAsRead).mockResolvedValueOnce(undefined);

      const { result } = renderActivityHook(() => useMarkFeedAsRead());

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(activityApi.markFeedAsRead).toHaveBeenCalled();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('useAccountLinks', () => {
    it('fetches account links', async () => {
      const links = createAccountLinks();
      vi.mocked(activityApi.fetchAccountLinks).mockResolvedValueOnce(links);

      const { result } = renderActivityHook(() => useAccountLinks());

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

      const { result } = renderActivityHook(() => useCreateAccountLink());

      await act(async () => {
        await result.current.mutateAsync({
          sourceId: TEST_ACTIVITY_VALUES.sourceId,
          settingsJson: TEST_ACTIVITY_VALUES.accountLinkSettings,
        });
      });

      expect(activityApi.createAccountLink).toHaveBeenCalledWith({
        sourceId: TEST_ACTIVITY_VALUES.sourceId,
        settingsJson: TEST_ACTIVITY_VALUES.accountLinkSettings,
      });
    });
  });

  describe('useDeleteAccountLink', () => {
    it('deletes account link', async () => {
      vi.mocked(activityApi.deleteAccountLink).mockResolvedValueOnce(undefined);

      const { result } = renderActivityHook(() => useDeleteAccountLink());

      await act(async () => {
        await result.current.mutateAsync(TEST_ACTIVITY_VALUES.accountLinkId);
      });

      expect(activityApi.deleteAccountLink).toHaveBeenCalledWith(TEST_ACTIVITY_VALUES.accountLinkId);
    });
  });

  describe('useSources', () => {
    it('fetches sources', async () => {
      const sources = createSources();
      vi.mocked(activityApi.fetchSources).mockResolvedValueOnce(sources);

      const { result } = renderActivityHook(() => useSources());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(sources);
    });
  });

  describe('useFeedFilter', () => {
    it('adds type to active filters when toggled', async () => {
      vi.mocked(activityApi.fetchFeedV2).mockResolvedValue(createActivityFeedV2());

      const { result } = renderActivityHook(() => useFeedFilter());

      await waitFor(() => {
        expect(result.current.items.length).toBeGreaterThan(0);
      });

      act(() => {
        result.current.toggleType('vote.cast');
      });

      expect(result.current.activeTypes).toContain('vote.cast');
    });

    it('replaces active filters when setting explicit filter list', async () => {
      vi.mocked(activityApi.fetchFeedV2).mockResolvedValue(createActivityFeedV2());

      const { result } = renderActivityHook(() => useFeedFilter());

      await waitFor(() => {
        expect(result.current.items.length).toBeGreaterThan(0);
      });

      act(() => {
        result.current.setTypeFilter(FEED_FILTER_TYPES);
      });

      expect(result.current.activeTypes).toEqual(FEED_FILTER_TYPES);
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
  it.each([
    ['all', () => activityKeys.all, ['activity']],
    ['feed', () => activityKeys.feed(), ['activity', 'feed']],
    ['unread count', () => activityKeys.unreadCount(), ['activity', 'unread-count']],
    ['account links', () => activityKeys.accountLinks(), ['activity', 'account-links']],
    ['sources', () => activityKeys.sources(), ['activity', 'sources']],
    ['subscriptions', () => activityKeys.subscriptions(), ['activity', 'subscriptions']],
  ])('returns %s key', (_name, getKey, expected) => {
    expect(getKey()).toEqual(expected);
  });

  it('includes params in feed list key', () => {
    expect(activityKeys.feedList(FEED_FILTER_PARAMS)).toEqual(['activity', 'feed', FEED_FILTER_PARAMS]);
  });

  it('includes params in infinite feed key', () => {
    expect(activityKeys.feedInfinite({ types: FEED_FILTER_TYPES[0] })).toEqual([
      'activity',
      'feed',
      'infinite',
      { types: FEED_FILTER_TYPES[0] },
    ]);
  });
});
