/**
 * Tests for usePreferences hook
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

import { usePreferences } from '../hooks/usePreferences';
import * as personalizationApi from '../api/personalizationApi';

// Mock the API
vi.mock('../api/personalizationApi', () => ({
  fetchPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  resetPreferences: vi.fn(),
  fetchDefaultPreferences: vi.fn(),
}));

const createWrapper = (
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  }),
) => {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
};

const mockPreferences = {
  id: 'test-id',
  user_id: 'user-123',
  tenant_id: 'tenant-456',
  appearance: {
    theme: 'light' as const,
    theme_source: 'portal' as const,
    accent_color: '#007AFF',
    font_size: 'medium' as const,
    high_contrast: false,
    reduce_motion: false,
  },
  localization: {
    language: 'en' as const,
    timezone: 'UTC',
  },
  notifications: {
    email: { enabled: true, digest: 'daily' as const },
    in_app: { enabled: true },
    push: { enabled: false },
    types: {},
    quiet_hours: { enabled: false, start: '22:00', end: '08:00' },
  },
  privacy: {
    profile_visibility: 'members' as const,
    show_online_status: true,
    show_vote_history: false,
    share_activity: true,
    allow_mentions: true,
    analytics_enabled: true,
    recommendations_enabled: true,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('usePreferences', () => {
  let wrapper: ReturnType<typeof createWrapper>;

  beforeEach(() => {
    wrapper = createWrapper();
    vi.clearAllMocks();

    vi.mocked(personalizationApi.fetchPreferences).mockResolvedValue(
      mockPreferences,
    );
    vi.mocked(personalizationApi.updatePreferences).mockResolvedValue({
      ...mockPreferences,
    });
    vi.mocked(personalizationApi.resetPreferences).mockResolvedValue(
      mockPreferences,
    );
    vi.mocked(personalizationApi.fetchDefaultPreferences).mockResolvedValue({
      appearance: mockPreferences.appearance,
      localization: mockPreferences.localization,
      notifications: mockPreferences.notifications,
      privacy: mockPreferences.privacy,
    });
    window.localStorage.clear();
  });

  it('fetches preferences on mount', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(personalizationApi.fetchPreferences).toHaveBeenCalledTimes(1);
    expect(result.current.preferences).toEqual(mockPreferences);
  });

  it('updates appearance preferences', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const newAppearance = { theme: 'dark' as const };
    await act(() => result.current.updateAppearance(newAppearance));

    expect(personalizationApi.updatePreferences).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(personalizationApi.updatePreferences).mock.calls[0]?.[0],
    ).toEqual({
      appearance: newAppearance,
    });
  });

  it('updates notification preferences', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const newNotifications = {
      email: { enabled: false, digest: 'weekly' as const },
    };
    await act(() => result.current.updateNotifications(newNotifications));

    expect(personalizationApi.updatePreferences).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(personalizationApi.updatePreferences).mock.calls[0]?.[0],
    ).toEqual({
      notifications: newNotifications,
    });
  });

  it('resets preferences to defaults', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(() => result.current.resetToDefaults());

    expect(personalizationApi.resetPreferences).toHaveBeenCalledTimes(1);
  });

  it('handles loading states correctly', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isResetting).toBe(false);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('serializes writes, keeps the newest intent visible, and finishes after leaving settings', async () => {
    const client = new QueryClient();
    const responses: Array<(data: typeof mockPreferences) => void> = [];
    vi.mocked(personalizationApi.updatePreferences).mockImplementation(
      () => new Promise((resolve) => responses.push(resolve)),
    );
    const hook = renderHook(() => usePreferences(), {
      wrapper: createWrapper(client),
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    const writes: Promise<void>[] = [];
    act(() => {
      writes.push(
        hook.result.current.savePreferences({ appearance: { theme: 'dark' } }),
      );
      writes.push(
        hook.result.current.savePreferences({ appearance: { theme: 'auto' } }),
      );
      writes.push(
        hook.result.current.savePreferences({
          appearance: { theme: 'light', accent_color: '#2563EB' },
        }),
      );
    });
    expect(personalizationApi.updatePreferences).toHaveBeenCalledTimes(1);
    expect(
      client.getQueryData<typeof mockPreferences>(['preferences'])?.appearance,
    ).toMatchObject({ theme: 'light', accent_color: '#2563EB' });
    hook.unmount();
    await act(async () =>
      responses[0]({
        ...mockPreferences,
        appearance: { ...mockPreferences.appearance, theme: 'dark' },
      } as typeof mockPreferences),
    );
    expect(personalizationApi.updatePreferences).toHaveBeenCalledTimes(2);
    expect(personalizationApi.updatePreferences).toHaveBeenLastCalledWith({
      appearance: { theme: 'light', accent_color: '#2563EB' },
    });
    expect(
      client.getQueryData<typeof mockPreferences>(['preferences'])?.appearance
        .theme,
    ).toBe('light');
    await act(async () => {
      responses[1]({
        ...mockPreferences,
        appearance: { ...mockPreferences.appearance, accent_color: '#2563EB' },
      });
      await Promise.all(writes);
    });
    expect(
      client.getQueryData<typeof mockPreferences>(['preferences'])?.appearance
        .accent_color,
    ).toBe('#2563EB');
    client.clear();
  });

  it('persists another selection made as soon as the previous save resolves', async () => {
    const hook = renderHook(() => usePreferences(), { wrapper });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    let second!: Promise<void>;
    await act(async () => {
      await hook.result.current.savePreferences({
        appearance: { theme: 'dark' },
      });
      second = hook.result.current.savePreferences({
        appearance: { theme: 'auto' },
      });
    });
    await waitFor(
      () =>
        expect(personalizationApi.updatePreferences).toHaveBeenCalledTimes(2),
      { timeout: 200 },
    );
    await act(() => second);
  });

  it('keeps local choices on failure and retries only on explicit action', async () => {
    const client = new QueryClient();
    const hook = renderHook(() => usePreferences(), {
      wrapper: createWrapper(client),
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    vi.mocked(personalizationApi.updatePreferences).mockRejectedValueOnce(
      new Error('offline'),
    );
    await act(async () => {
      await hook.result.current
        .savePreferences({ appearance: { theme: 'dark' } })
        .catch(() => {});
    });
    await waitFor(() =>
      expect(hook.result.current.saveError?.message).toBe('offline'),
    );
    expect(hook.result.current.preferences?.appearance.theme).toBe('dark');
    await act(() => hook.result.current.reload());
    expect(hook.result.current.preferences?.appearance.theme).toBe('dark');
    expect(personalizationApi.updatePreferences).toHaveBeenCalledTimes(1);
    vi.mocked(personalizationApi.updatePreferences).mockResolvedValueOnce({
      ...mockPreferences,
      appearance: { ...mockPreferences.appearance, theme: 'dark' },
    });
    await act(() => hook.result.current.retrySave());
    expect(personalizationApi.updatePreferences).toHaveBeenLastCalledWith({
      appearance: { theme: 'dark' },
    });
    expect(hook.result.current.saveError).toBeNull();
    hook.unmount();
    client.clear();
  });

  it('discards queued work and ignores a late response when the private context is cleared', async () => {
    const client = new QueryClient();
    let respond!: (data: typeof mockPreferences) => void;
    vi.mocked(personalizationApi.updatePreferences).mockImplementation(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    );
    const hook = renderHook(() => usePreferences(), {
      wrapper: createWrapper(client),
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    act(() => {
      void hook.result.current
        .savePreferences({ appearance: { theme: 'dark' } })
        .catch(() => {});
      void hook.result.current
        .savePreferences({ appearance: { theme: 'auto' } })
        .catch(() => {});
    });
    hook.unmount();
    client.clear();
    await act(async () => respond(mockPreferences));
    expect(personalizationApi.updatePreferences).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['preferences'])).toBeUndefined();
  });

  it('waits for a pending write before resetting, so its response cannot undo the reset', async () => {
    let respond!: (data: typeof mockPreferences) => void;
    vi.mocked(personalizationApi.updatePreferences).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    );
    const hook = renderHook(() => usePreferences(), { wrapper });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    let write!: Promise<void>, reset!: Promise<void>;
    act(() => {
      write = hook.result.current.savePreferences({
        appearance: { theme: 'dark' },
      });
      reset = hook.result.current.resetToDefaults();
    });
    expect(personalizationApi.resetPreferences).not.toHaveBeenCalled();
    await act(async () => {
      respond({
        ...mockPreferences,
        appearance: { ...mockPreferences.appearance, theme: 'dark' },
      } as typeof mockPreferences);
      await write;
      await reset;
    });
    expect(personalizationApi.resetPreferences).toHaveBeenCalledTimes(1);
    expect(hook.result.current.preferences?.appearance.theme).toBe('light');
  });

  it('caches preferences to localStorage', async () => {
    renderHook(() => usePreferences(), { wrapper });
    await waitFor(() => {
      expect(
        window.localStorage.getItem('personalization-preferences-cache-v1'),
      ).not.toBeNull();
    });
  });
});
