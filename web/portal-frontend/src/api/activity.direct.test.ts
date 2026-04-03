import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./activity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./activity')>();
  return actual;
});
vi.mock('./client', () => ({ request: vi.fn() }));

import { request } from './client';
import {
  createAccountLink,
  createActivityGame,
  createNews,
  createNewsComment,
  deleteAccountLink,
  deleteNews,
  fetchAccountLinkDetail,
  fetchAccountLinks,
  fetchActivityGames,
  fetchActivityHealth,
  fetchActivityMetrics,
  fetchFeed,
  fetchFeedV2,
  fetchSourceDetail,
  fetchSources,
  fetchSubscriptions,
  fetchSyncStatus,
  fetchUnreadCount,
  listNewsComments,
  markFeedAsRead,
  reactToNews,
  requestNewsMediaUpload,
  triggerSync,
  updateAccountLink,
  updateNews,
  updateSubscriptions,
  uploadNewsMediaFile,
} from './activity';

describe('activity direct api wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(request).mockImplementation(async (url: string) => {
      if (url.includes('/activity/v2/feed')) {
        return { items: [{ id: 2, tenant_id: 't', actor_user_id: 'u', target_user_id: null, type: 'event.created', occurred_at: '2026-01-02', title: 'y', payload_json: {}, visibility: 'team', scope_type: 'TEAM', scope_id: 'tm', source_ref: 's2' }], next_cursor: 'c1', has_more: true };
      }
      if (url.includes('/activity/feed?')) {
        return { items: [{ id: 1, tenant_id: 't', actor_user_id: null, target_user_id: null, type: 'vote.cast', occurred_at: '2026-01-01', title: 'x', payload_json: {}, visibility: 'public', scope_type: 'TENANT', scope_id: 't', source_ref: 's' }] };
      }
      if (url === '/activity/feed/unread-count') return { count: 7 };
      if (url === '/activity/feed/mark-read') return undefined;
      if (url === '/activity/news/media/upload-url') return { key: 'k', upload_url: 'https://upload', upload_headers: { a: 'b' }, expires_in: 60 };
      if (url === '/activity/news' || url === '/activity/news/n1') return { id: 3, tenant_id: 't', actor_user_id: 'u', target_user_id: null, type: 'post.created', occurred_at: '2026-01-03', title: 'n', payload_json: {}, visibility: 'public', scope_type: 'TENANT', scope_id: 't', source_ref: 'news' };
      if (url.endsWith('/reactions')) return [{ emoji: '🔥', count: 2 }];
      if (url.endsWith('/comments?limit=5')) return [{ id: 1, user_id: 'u', body: 'c', created_at: 'd' }];
      if (url.endsWith('/comments')) return { id: 2, user_id: 'u', body: 'c2', created_at: 'd2' };
      if (url === '/activity/games') return { items: [{ id: 1 }] };
      if (url === '/activity/sources') return { items: [{ id: 5 }] };
      if (url.startsWith('/activity/sources/')) return { id: 5 };
      if (url === '/activity/account-links') return { items: [{ id: 5 }] };
      if (url.startsWith('/activity/account-links/')) return { id: 5 };
      if (url === '/activity/subscriptions') return { items: [{ id: 1, tenant_id: 't', user_id: 'u', rules_json: {} }] };
      if (url === '/activity/sync/run') return { ok: true };
      if (url.startsWith('/activity/sync/status/')) return { status: 'ok' };
      if (url === '/activity/health') return { status: 'ok' };
      if (url === '/activity/metrics') return { activityEventsTotal: 1 };
      return { id: 1 };
    });
  });

  it('covers feed endpoints and unread flow', async () => {
    const feed = await fetchFeed({ types: 'vote.cast', scopeType: 'TEAM', scopeId: 'tm', limit: 10 });
    const feedV2 = await fetchFeedV2({ cursor: 'c0', limit: 5 });
    const unread = await fetchUnreadCount();
    await markFeedAsRead();
    expect(feed[0].tenantId).toBe('t');
    expect(feedV2).toMatchObject({ nextCursor: 'c1', hasMore: true });
    expect(unread).toBe(7);
  });

  it('covers news/media, links, subscriptions and health/sync wrappers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    await requestNewsMediaUpload({ filename: 'a.png', content_type: 'image/png', size_bytes: 1 });
    await createNews({ body: 'body', visibility: 'public' });
    await updateNews('n1', { title: 'upd' });
    await deleteNews('n1');
    await reactToNews('n1', { emoji: '🔥' });
    await listNewsComments('n1', 5);
    await createNewsComment('n1', 'hi');
    await fetchActivityGames();
    await createActivityGame({ name: 'Game' } as never);
    await fetchSources();
    await fetchSourceDetail(1);
    await fetchAccountLinks();
    await fetchAccountLinkDetail(5);
    await createAccountLink({ sourceId: 1, settingsJson: {} });
    await updateAccountLink(5, { settingsJson: { x: 1 } });
    await deleteAccountLink(5);
    const subs = await fetchSubscriptions();
    const updatedSubs = await updateSubscriptions({ scopes: [{ scopeType: 'TEAM', scopeId: 'x' }] });
    await triggerSync();
    await fetchSyncStatus(5);
    await fetchActivityHealth();
    await fetchActivityMetrics();

    await expect(uploadNewsMediaFile('https://upload', { a: 'b' }, new File(['x'], 'x.txt'))).resolves.toBeUndefined();
    expect(subs).toHaveLength(1);
    expect(updatedSubs).toBeDefined();
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
