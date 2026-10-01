import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { I18nContext } from '../../../app/providers/i18nContext';
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
    capabilities: [
      'activity.feed.read',
      'activity.news.create',
      'activity.news.manage',
    ],
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
  can: (
    user: { capabilities?: string[] } | null,
    required?: string | string[],
  ) => {
    if (!required) return true;
    if (!user?.capabilities) return false;
    if (Array.isArray(required))
      return required.some((r) => user.capabilities?.includes(r));
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
    payloadJson: {
      news_id: 'news-remote',
      body: 'remote',
      tags: [],
      status: 'published',
    },
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
  useCreateNews: () => ({
    mutateAsync: (...args: unknown[]) => createNewsMutationMock(...args),
    isPending: false,
  }),
  useDraftNews: () => ({ data: [] }),
  useNews: () => ({ data: null }),
  useSubscriptions: () => ({
    data: [{ rulesJson: { scopes: [{ scopeType: 'tenant', scopeId: 't1' }] } }],
    isLoading: false,
  }),
  useUpdateSubscriptions: () => ({
    mutateAsync: (...args: unknown[]) => updateSubscriptionsMock(...args),
    isPending: false,
  }),
}));

function createWrapper(locale: 'en' | 'ru' = 'ru') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <I18nContext.Provider
      value={{
        locale,
        timezone: 'UTC',
        changeLocale: vi.fn(),
        changeTimezone: vi.fn(),
      }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </I18nContext.Provider>
  );
}

describe('useFeedPageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (globalThis as unknown as { EventSource?: unknown }).EventSource =
      undefined;

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

    const { result } = renderHook(() => useFeedPageController(), {
      wrapper: createWrapper(),
    });

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

  it('keeps the text visible while publishing and preserves edits when the response fails', async () => {
    let reject!: (error: Error) => void;
    createNewsMutationMock.mockReturnValue(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    const { result } = renderHook(() => useFeedPageController(), {
      wrapper: createWrapper(),
    });
    act(() => result.current.setComposerValue('Original text'));
    let operation!: Promise<void>;
    act(() => {
      operation = result.current.handlePublishNews();
    });
    expect(result.current.composerValue).toBe('Original text');
    act(() =>
      result.current.setComposerValue('Original text, edited while sending'),
    );
    await act(async () => {
      reject(new Error('offline'));
      await operation;
    });
    expect(result.current.composerValue).toBe(
      'Original text, edited while sending',
    );
  });

  it.each([
    ['en', 500, 'We could not confirm the result.'],
    ['ru', 500, 'Не удалось подтвердить результат.'],
    ['en', 403, 'Unable to save the post.'],
    ['ru', 403, 'Не удалось сохранить публикацию.'],
  ] as const)(
    'keeps a single localized error and draft for %s / %i',
    async (locale, status, message) => {
      createNewsMutationMock.mockRejectedValue(
        Object.assign(new Error('feed upstream returned error'), { status }),
      );
      const { result } = renderHook(() => useFeedPageController(), {
        wrapper: createWrapper(locale),
      });
      act(() => result.current.setComposerValue('Keep this draft'));
      await act(async () => {
        await result.current.handlePublishNews();
      });
      expect(result.current.publishError).toContain(message);
      expect(result.current.publishError).not.toContain('upstream');
      expect(result.current.composerValue).toBe('Keep this draft');
      expect(result.current.composerOpen).toBe(true);
      expect(createNewsMutationMock).toHaveBeenCalledTimes(1);
      expect(notifyApiErrorMock).not.toHaveBeenCalled();
    },
  );

  it('runs fallback refetch interval when EventSource is unavailable', () => {
    const { unmount } = renderHook(() => useFeedPageController(), {
      wrapper: createWrapper(),
    });

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(refetchMock).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('closes a failed live connection and polls without reconnecting', () => {
    const source = {
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onerror: null as (() => void) | null,
    };
    const EventSourceMock = vi.fn(function () {
      return source;
    });
    vi.stubGlobal('EventSource', EventSourceMock);
    const { unmount } = renderHook(() => useFeedPageController(), {
      wrapper: createWrapper(),
    });
    act(() => source.onerror?.());
    expect(source.close).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(refetchMock).toHaveBeenCalledTimes(2);
    expect(EventSourceMock).toHaveBeenCalledTimes(1);
    unmount();
    vi.unstubAllGlobals();
  });
});
