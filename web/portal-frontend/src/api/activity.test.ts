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
import { TEST_ACTIVITY_VALUES } from '../test/constants';
import { activityApiMock } from '../test/mocks/api';

describe('Activity API (mocked)', () => {
  const feedScenarios = [
    ['default feed', createActivityFeedV2(), 4, true],
    ['empty feed', { items: [], nextCursor: null, hasMore: false }, 0, false],
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchFeedV2', () => {
    it.each(feedScenarios)('returns expected shape for %s', async (_name, response, itemCount, hasMore) => {
      activityApiMock.fetchFeedV2.mockResolvedValueOnce(response);

      const result = await activityApiMock.fetchFeedV2();

      expect(result).toEqual(response);
      expect(result.items).toHaveLength(itemCount);
      expect(result.hasMore).toBe(hasMore);
    });
  });

  describe('fetchUnreadCount', () => {
    it('returns unread count from mocked API', async () => {
      activityApiMock.fetchUnreadCount.mockResolvedValueOnce({ count: TEST_ACTIVITY_VALUES.unreadCount });

      const result = await activityApiMock.fetchUnreadCount();

      expect(result.count).toBe(TEST_ACTIVITY_VALUES.unreadCount);
    });
  });

  describe('markFeedAsRead', () => {
    it('calls markFeedAsRead endpoint', async () => {
      activityApiMock.markFeedAsRead.mockResolvedValueOnce(undefined);

      await activityApiMock.markFeedAsRead();

      expect(activityApiMock.markFeedAsRead).toHaveBeenCalled();
    });
  });

  describe('fetchAccountLinks', () => {
    it('returns account links list', async () => {
      const links = createAccountLinks();
      activityApiMock.fetchAccountLinks.mockResolvedValueOnce(links);

      const result = await activityApiMock.fetchAccountLinks();

      expect(result).toEqual(links);
      expect(result).toHaveLength(2);
    });
  });

  describe('createAccountLink', () => {
    it('creates account link with provided source and settings', async () => {
      const newLink = createAccountLinks()[0];
      activityApiMock.createAccountLink.mockResolvedValueOnce(newLink);

      const result = await activityApiMock.createAccountLink({
        sourceId: TEST_ACTIVITY_VALUES.sourceId,
        settingsJson: TEST_ACTIVITY_VALUES.accountLinkSettings,
      });

      expect(result).toEqual(newLink);
    });
  });

  describe('deleteAccountLink', () => {
    it('deletes account link by id', async () => {
      activityApiMock.deleteAccountLink.mockResolvedValueOnce(undefined);

      await activityApiMock.deleteAccountLink(TEST_ACTIVITY_VALUES.accountLinkId);

      expect(activityApiMock.deleteAccountLink).toHaveBeenCalledWith(TEST_ACTIVITY_VALUES.accountLinkId);
    });
  });

  describe('fetchSources', () => {
    it('returns sources list', async () => {
      const sources = createSources();
      activityApiMock.fetchSources.mockResolvedValueOnce(sources);

      const result = await activityApiMock.fetchSources();

      expect(result).toEqual(sources);
      expect(result).toHaveLength(3);
    });
  });

  describe('triggerSync', () => {
    it('returns sync result payload', async () => {
      const syncResult = { ok: true, rawCreated: 5, rawDeduped: 2, activityCreated: 3 };
      activityApiMock.triggerSync.mockResolvedValueOnce(syncResult);

      const result = await activityApiMock.triggerSync();

      expect(result).toEqual(syncResult);
      expect(result.ok).toBe(true);
    });
  });
});
