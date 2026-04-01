import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFeedPageController } from './useFeedPageController';

const refetchMock = vi.fn();
const deleteNewsMock = vi.fn();
const updateSubscriptionsMock = vi.fn();
const notifyApiErrorMock = vi.fn();

const editorMock = {
  getValue: vi.fn(() => ''),
  on: vi.fn(),
  off: vi.fn(),
  setValue: vi.fn(),
};

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

vi.mock('@gravity-ui/markdown-editor', () => ({
  useMarkdownEditor: () => editorMock,
}));

vi.mock('../../../api/activity', () => ({
  deleteNews: (...args: unknown[]) => deleteNewsMock(...args),
  requestNewsMediaUpload: vi.fn(),
  uploadNewsMediaFile: vi.fn(),
}));

vi.mock('../../../utils/apiErrorHandling', () => ({
  notifyApiError: (...args: unknown[]) => notifyApiErrorMock(...args),
}));

vi.mock('../../../hooks/useActivity', () => ({
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
  useCreateNews: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSubscriptions: () => ({ data: [{ rulesJson: { scopes: [{ scopeType: 'tenant', scopeId: 't1' }] } }], isLoading: false }),
  useUpdateSubscriptions: () => ({ mutateAsync: (...args: unknown[]) => updateSubscriptionsMock(...args), isPending: false }),
}));

describe('useFeedPageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

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

  it('validates moderation reason before batch action', async () => {
    const { result } = renderHook(() => useFeedPageController());

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
    const { result } = renderHook(() => useFeedPageController());

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
    const { result } = renderHook(() => useFeedPageController());

    act(() => {
      for (let index = 0; index < 30; index += 1) {
        result.current.handleModerationToggle(`news-${index}`, true);
      }
    });

    expect(result.current.selectedModerationIds).toHaveLength(20);
  });

  it('runs realtime refetch on interval when feature flag is enabled', () => {
    authState.user.featureFlags = { activity_feed_realtime_enabled: true };
    const { unmount } = renderHook(() => useFeedPageController());

    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(refetchMock).toHaveBeenCalledTimes(1);
    unmount();
    authState.user.featureFlags = {};
  });

  it('toggles moderation mode with Alt+M hotkey', () => {
    const { result } = renderHook(() => useFeedPageController());
    expect(result.current.moderationMode).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', altKey: true }));
    });
    expect(result.current.moderationMode).toBe(true);
  });

  it('exits moderation mode with Escape hotkey', () => {
    const { result } = renderHook(() => useFeedPageController());

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
    const { result } = renderHook(() => useFeedPageController());
    const input = document.createElement('input');
    document.body.appendChild(input);

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', altKey: true, bubbles: true }));
    });

    expect(result.current.moderationMode).toBe(false);
    input.remove();
  });

  it('does not exit moderation on Escape while typing in textarea', () => {
    const { result } = renderHook(() => useFeedPageController());
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
