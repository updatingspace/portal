import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useFeedPageController } from './useFeedPageController';

const refetchMock = vi.fn();
const deleteNewsMock = vi.fn();
const updateSubscriptionsMock = vi.fn();
const notifyApiErrorMock = vi.fn();
const createNewsMutationMock = vi.fn();

const authState = {
  user: {
    id: 'u1',
    tenant: { id: 't1', slug: 'tenant' },
    capabilities: ['activity.feed.read', 'activity.news.create', 'activity.news.manage'],
    featureFlags: {},
  },
};

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({}),
}));

vi.mock('../../../features/rbac/can', () => ({
  can: (user: { capabilities?: string[] } | null, required?: string | string[]) => {
    if (!required) return true;
    if (!user?.capabilities) return false;
    if (Array.isArray(required)) return required.some((r) => user.capabilities?.includes(r));
    return user.capabilities.includes(required);
  },
}));

vi.mock('./useFeedFilters', () => ({
  useFeedFilters: () => ({
    source: 'all',
    period: 'week',
    sort: 'best',
    setSource: vi.fn(),
    setPeriod: vi.fn(),
    setSort: vi.fn(),
    resetFilters: vi.fn(),
  }),
}));

vi.mock('../../../api/activity', () => ({
  buildFeedLiveUrl: vi.fn(() => 'http://localhost/feed/live'),
  deleteNews: (...args: unknown[]) => deleteNewsMock(...args),
  fetchNews: vi.fn(async () => ({
    id: 999,
    tenantId: 't1',
    actorUserId: 'u1',
    targetUserId: null,
    type: 'news.posted',
    occurredAt: new Date().toISOString(),
    title: 'news',
    payloadJson: { news_id: 'news-remote', body: 'remote', tags: [], status: 'published' },
    visibility: 'public',
    scopeType: 'TENANT',
    scopeId: 't1',
    sourceRef: 'news:news-remote',
    actorProfile: null,
  })),
  requestNewsMediaUpload: vi.fn(),
  uploadNewsMediaFile: vi.fn(),
}));

vi.mock('../../../utils/apiErrorHandling', () => ({
  notifyApiError: (...args: unknown[]) => notifyApiErrorMock(...args),
}));

vi.mock('../../../hooks/useActivity', () => ({
  activityKeys: {
    feed: () => ['activity', 'feed'],
    unreadCount: () => ['activity', 'unread-count'],
    newsById: (newsId: string) => ['activity', 'news', newsId],
    drafts: () => ['activity', 'news', 'drafts'],
  },
  useFeedInfinite: () => ({
    data: { pages: [{ items: [] }] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    error: null,
    refetch: refetchMock,
  }),
  useUnreadCount: () => ({ count: 0 }),
  useMarkFeedAsRead: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateNews: () => ({ mutateAsync: (...args: unknown[]) => createNewsMutationMock(...args), isPending: false }),
  useDraftNews: () => ({ data: [] }),
  useNews: () => ({ data: null }),
  useSubscriptions: () => ({ data: [{ rulesJson: { scopes: [{ scopeType: 'tenant', scopeId: 't1' }] } }], isLoading: false }),
  useUpdateSubscriptions: () => ({ mutateAsync: (...args: unknown[]) => updateSubscriptionsMock(...args), isPending: false }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useFeedPageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (globalThis as unknown as { EventSource?: unknown }).EventSource = undefined;

    globalThis.IntersectionObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
      root = null;
      rootMargin = '';
      thresholds = [];
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    };
  });

  it('publishes text-only news without requiring media', async () => {
    createNewsMutationMock.mockResolvedValue({ id: 1 });

    const { result } = renderHook(() => useFeedPageController(), { wrapper: createWrapper() });

    act(() => {
      result.current.setComposerValue('Короткое обновление без вложений');
    });

    await act(async () => {
      await result.current.handlePublishNews();
    });

    expect(createNewsMutationMock).toHaveBeenCalledTimes(1);
    expect(createNewsMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Короткое обновление без вложений',
        media: [],
      }),
    );
  });

  it('validates moderation reason before batch action', async () => {
    const { result } = renderHook(() => useFeedPageController(), { wrapper: createWrapper() });

    act(() => {
      result.current.toggleModerationMode();
    });
    await act(async () => {
      await result.current.handleModerationDeleteSelected();
    });

    expect(result.current.moderationError).toBe('Укажите причину модераторского действия');
    expect(deleteNewsMock).not.toHaveBeenCalled();
  });

  it('validates selected items before batch action', async () => {
    const { result } = renderHook(() => useFeedPageController(), { wrapper: createWrapper() });

    act(() => {
      result.current.toggleModerationMode();
      result.current.setModerationReason('spam cleanup');
    });
    await act(async () => {
      await result.current.handleModerationDeleteSelected();
    });

    expect(result.current.moderationError).toBe('Выберите хотя бы одну новость');
    expect(deleteNewsMock).not.toHaveBeenCalled();
  });

  it('limits moderation selection to 20 items', () => {
    const { result } = renderHook(() => useFeedPageController(), { wrapper: createWrapper() });

    act(() => {
      Array.from({ length: 30 }, (_, index) => `news-${index}`).forEach((newsId) => {
        result.current.handleModerationToggle(newsId, true);
      });
    });

    expect(result.current.selectedModerationIds).toHaveLength(20);
  });

  it('runs fallback refetch interval when EventSource is unavailable', () => {
    const { unmount } = renderHook(() => useFeedPageController(), { wrapper: createWrapper() });

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(refetchMock).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('toggles moderation mode with Alt+M hotkey', () => {
    const { result } = renderHook(() => useFeedPageController(), { wrapper: createWrapper() });
    expect(result.current.moderationMode).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', altKey: true }));
    });
    expect(result.current.moderationMode).toBe(true);
  });

  it('exits moderation mode with Escape hotkey', () => {
    const { result } = renderHook(() => useFeedPageController(), { wrapper: createWrapper() });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', altKey: true }));
      result.current.setModerationReason('cleanup reason');
      result.current.handleModerationToggle('news-1', true);
    });
    expect(result.current.moderationMode).toBe(true);
    expect(result.current.selectedModerationIds).toHaveLength(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.moderationMode).toBe(false);
    expect(result.current.selectedModerationIds).toHaveLength(0);
    expect(result.current.moderationReason).toBe('');
  });

  it('ignores Alt+M when typing in input', () => {
    const { result } = renderHook(() => useFeedPageController(), { wrapper: createWrapper() });
    const input = document.createElement('input');
    document.body.appendChild(input);

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', altKey: true, bubbles: true }));
    });

    expect(result.current.moderationMode).toBe(false);
    input.remove();
  });

  it('does not exit moderation on Escape while typing in textarea', () => {
    const { result } = renderHook(() => useFeedPageController(), { wrapper: createWrapper() });
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', altKey: true }));
    });
    expect(result.current.moderationMode).toBe(true);

    act(() => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(result.current.moderationMode).toBe(true);
    textarea.remove();
  });
});
