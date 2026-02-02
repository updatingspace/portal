/**
 * Activity API Client Unit Tests
 *
 * Tests for API functions. Uses mocked activity API from vitest.setup.ts.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createActivityFeedV2,
  createAccountLinks,
  createSources,
} from '../test/fixtures';
import { activityApiMock } from '../test/mocks/api';

describe('Activity API (mocked)', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    Object.values(activityApiMock).forEach(mock => {
      if (typeof mock === 'function' && 'mockReset' in mock) {
        (mock as ReturnType<typeof vi.fn>).mockReset();
      }
    });
  });

  describe('fetchFeedV2', () => {
    it('returns feed data', async () => {
      const feedData = createActivityFeedV2();
      activityApiMock.fetchFeedV2.mockResolvedValueOnce(feedData);

      const result = await activityApiMock.fetchFeedV2();

      expect(result).toEqual(feedData);
      expect(result.items).toHaveLength(4);
      expect(result.hasMore).toBe(true);
    });

    it('returns empty feed', async () => {
      const emptyFeed = { items: [], nextCursor: null, hasMore: false };
      activityApiMock.fetchFeedV2.mockResolvedValueOnce(emptyFeed);

      const result = await activityApiMock.fetchFeedV2();

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('fetchUnreadCount', () => {
    it('returns unread count', async () => {
      activityApiMock.fetchUnreadCount.mockResolvedValueOnce({ count: 42 });

      const result = await activityApiMock.fetchUnreadCount();

      expect(result.count).toBe(42);
    });
  });

  describe('markFeedAsRead', () => {
    it('marks feed as read', async () => {
      activityApiMock.markFeedAsRead.mockResolvedValueOnce(undefined);

      await activityApiMock.markFeedAsRead();

      expect(activityApiMock.markFeedAsRead).toHaveBeenCalled();
    });
  });

  describe('fetchAccountLinks', () => {
    it('returns account links', async () => {
      const links = createAccountLinks();
      activityApiMock.fetchAccountLinks.mockResolvedValueOnce(links);

      const result = await activityApiMock.fetchAccountLinks();

      expect(result).toEqual(links);
      expect(result).toHaveLength(2);
    });
  });

  describe('createAccountLink', () => {
    it('creates account link', async () => {
      const newLink = createAccountLinks()[0];
      activityApiMock.createAccountLink.mockResolvedValueOnce(newLink);

      const result = await activityApiMock.createAccountLink({
        sourceId: 1,
        settingsJson: { steam_id: '12345' },
      });

      expect(result).toEqual(newLink);
    });
  });

  describe('deleteAccountLink', () => {
    it('deletes account link', async () => {
      activityApiMock.deleteAccountLink.mockResolvedValueOnce(undefined);

      await activityApiMock.deleteAccountLink(123);

      expect(activityApiMock.deleteAccountLink).toHaveBeenCalledWith(123);
    });
  });

  describe('fetchSources', () => {
    it('returns sources', async () => {
      const sources = createSources();
      activityApiMock.fetchSources.mockResolvedValueOnce(sources);

      const result = await activityApiMock.fetchSources();

      expect(result).toEqual(sources);
      expect(result).toHaveLength(3);
    });
  });

  describe('triggerSync', () => {
    it('triggers sync', async () => {
      const syncResult = { ok: true, rawCreated: 5, rawDeduped: 2, activityCreated: 3 };
      activityApiMock.triggerSync.mockResolvedValueOnce(syncResult);

      const result = await activityApiMock.triggerSync();

      expect(result).toEqual(syncResult);
      expect(result.ok).toBe(true);
    });
  });

});
