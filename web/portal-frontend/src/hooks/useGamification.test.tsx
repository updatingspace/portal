import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';

import {
  useAchievement,
  useAchievementsList,
  useCategories,
  useCreateAchievement,
  useCreateCategory,
  useUpdateAchievement,
  useUpdateCategory,
  useCreateGrant,
  useRevokeGrant,
  useGrantsList,
  gamificationKeys,
} from './useGamification';
import * as gamificationApi from '../api/gamification';

vi.mock('../api/gamification', () => ({
  listAchievements: vi.fn(),
  getAchievement: vi.fn(),
  createAchievement: vi.fn(),
  updateAchievement: vi.fn(),
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  listGrants: vi.fn(),
  createGrant: vi.fn(),
  revokeGrant: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { wrapper, queryClient };
};

describe('useGamification hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gamificationApi.listCategories).mockResolvedValue({
      items: [{ id: 'cat-default', nameI18n: { ru: 'Категория' } }],
      nextCursor: null,
    } as never);
  });

  it('loads achievements list with infinite query', async () => {
    vi.mocked(gamificationApi.listAchievements)
      .mockResolvedValueOnce({
        items: [{ id: 'a1', nameI18n: { ru: 'One' }, status: 'draft', category: 'cat' } as never],
        nextCursor: 'next-cursor',
      })
      .mockResolvedValueOnce({
        items: [{ id: 'a2', nameI18n: { ru: 'Two' }, status: 'published', category: 'cat' } as never],
        nextCursor: null,
      });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAchievementsList({ limit: 1 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0].items[0].id).toBe('a1');

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.data?.pages[1]?.items?.[0]?.id).toBe('a2');
  });

  it('does not execute useAchievement without id and executes with id', async () => {
    const { wrapper } = createWrapper();

    const withoutId = renderHook(() => useAchievement(undefined), { wrapper });
    expect(withoutId.result.current.isFetching).toBe(false);
    expect(gamificationApi.getAchievement).not.toHaveBeenCalled();

    vi.mocked(gamificationApi.getAchievement).mockResolvedValueOnce({
      id: 'a1',
      nameI18n: { ru: 'A1' },
      description: null,
      category: 'cat',
      status: 'draft',
      images: null,
      createdBy: 'u1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    const withId = renderHook(() => useAchievement('a1'), { wrapper });
    await waitFor(() => expect(withId.result.current.isSuccess).toBe(true));
    expect(gamificationApi.getAchievement).toHaveBeenCalledWith('a1');
  });

  it('invalidates caches after create/update/revoke mutations', async () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(gamificationApi.createAchievement).mockResolvedValueOnce({ id: 'a1' } as never);
    vi.mocked(gamificationApi.updateAchievement).mockResolvedValueOnce({ id: 'a1' } as never);
    vi.mocked(gamificationApi.createGrant).mockResolvedValueOnce({ id: 'g1' } as never);
    vi.mocked(gamificationApi.revokeGrant).mockResolvedValueOnce({ id: 'g1' } as never);

    const createHook = renderHook(() => useCreateAchievement(), { wrapper });
    const updateHook = renderHook(() => useUpdateAchievement(), { wrapper });
    const createGrantHook = renderHook(() => useCreateGrant(), { wrapper });
    const revokeGrantHook = renderHook(() => useRevokeGrant(), { wrapper });

    await act(async () => {
      await createHook.result.current.mutateAsync({ nameI18n: { ru: 'A' }, category: 'cat' });
      await updateHook.result.current.mutateAsync({ id: 'a1', payload: { status: 'hidden' } });
      await createGrantHook.result.current.mutateAsync({
        achievementId: 'a1',
        payload: { recipientId: 'u2', visibility: 'public' },
      });
      await revokeGrantHook.result.current.mutateAsync({ grantId: 'g1' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: gamificationKeys.achievements() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: gamificationKeys.achievement('a1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: gamificationKeys.grants('a1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: gamificationKeys.all });
  });

  it('loads categories and invalidates after category mutations', async () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(gamificationApi.listCategories).mockResolvedValueOnce({
      items: [{ id: 'cat-1', nameI18n: { ru: 'Категория' } }],
      nextCursor: null,
    } as never);
    vi.mocked(gamificationApi.createCategory).mockResolvedValueOnce({ id: 'cat-2' } as never);
    vi.mocked(gamificationApi.updateCategory).mockResolvedValueOnce({ id: 'cat-1' } as never);

    const categoriesHook = renderHook(() => useCategories(), { wrapper });
    await waitFor(() => expect(categoriesHook.result.current.isSuccess).toBe(true));
    expect(gamificationApi.listCategories).toHaveBeenCalled();

    const createCategoryHook = renderHook(() => useCreateCategory(), { wrapper });
    const updateCategoryHook = renderHook(() => useUpdateCategory(), { wrapper });

    await act(async () => {
      await createCategoryHook.result.current.mutateAsync({ id: 'cat-2', nameI18n: { ru: 'Новая' } });
      await updateCategoryHook.result.current.mutateAsync({
        id: 'cat-1',
        payload: { nameI18n: { ru: 'Обновлённая' } },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: gamificationKeys.categories() });
  });

  it('handles grants pagination and does not fetch without achievement id', async () => {
    vi.mocked(gamificationApi.listGrants)
      .mockResolvedValueOnce({
        items: [{ id: 'g1', recipientId: 'u1', visibility: 'public' }],
        nextCursor: 'next',
      } as never)
      .mockResolvedValueOnce({
        items: [{ id: 'g2', recipientId: 'u2', visibility: 'private' }],
        nextCursor: null,
      } as never);

    const { wrapper } = createWrapper();
    const disabled = renderHook(() => useGrantsList('', { visibility: 'public' }), { wrapper });
    expect(disabled.result.current.isFetching).toBe(false);
    expect(gamificationApi.listGrants).not.toHaveBeenCalled();

    const enabled = renderHook(() => useGrantsList('a1', { visibility: 'public', limit: 1 }), { wrapper });
    await waitFor(() => expect(enabled.result.current.isSuccess).toBe(true));
    expect(enabled.result.current.data?.pages[0]?.items[0]?.id).toBe('g1');

    await act(async () => {
      await enabled.result.current.fetchNextPage();
    });

    await waitFor(() => expect(enabled.result.current.data?.pages).toHaveLength(2));
    expect(enabled.result.current.data?.pages[1]?.items[0]?.id).toBe('g2');
  });

  it('exposes stable key factories for deterministic caching', () => {
    expect(gamificationKeys.all).toEqual(['gamification']);
    expect(gamificationKeys.achievements()).toEqual(['gamification', 'achievements']);
    expect(gamificationKeys.achievement('id-1')).toEqual(['gamification', 'achievements', 'id-1']);
    expect(gamificationKeys.grants('a1', { visibility: 'public' })).toEqual([
      'gamification',
      'grants',
      'a1',
      { visibility: 'public' },
    ]);
  });
});
