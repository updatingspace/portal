import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createAchievement,
  createCategory,
  createGrant,
  getAchievement,
  listAchievements,
  listCategories,
  listGrants,
  revokeGrant,
  updateAchievement,
  updateCategory,
} from '../api/gamification';
import type {
  AchievementCreatePayload,
  AchievementUpdatePayload,
  CategoryCreatePayload,
  CategoryUpdatePayload,
  GrantCreatePayload,
} from '../types/gamification';

export const gamificationKeys = {
  all: ['gamification'] as const,
  achievements: () => [...gamificationKeys.all, 'achievements'] as const,
  achievementsList: (params?: Record<string, unknown>) =>
    [...gamificationKeys.achievements(), params] as const,
  achievement: (id: string) => [...gamificationKeys.achievements(), id] as const,
  categories: () => [...gamificationKeys.all, 'categories'] as const,
  grants: (achievementId: string, params?: Record<string, unknown>) =>
    [...gamificationKeys.all, 'grants', achievementId, params] as const,
};

export function useAchievementsList(params?: {
  status?: string[];
  category?: string[];
  q?: string;
  created_by?: 'me' | 'any';
  limit?: number;
}) {
  return useInfiniteQuery({
    queryKey: gamificationKeys.achievementsList(params ?? {}),
    queryFn: ({ pageParam }) =>
      listAchievements({ ...params, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.nextCursor ? lastPage.nextCursor : undefined),
    staleTime: 30_000,
  });
}

export function useAchievement(id?: string) {
  return useQuery({
    queryKey: id ? gamificationKeys.achievement(id) : [...gamificationKeys.achievements(), 'none'],
    queryFn: () => {
      if (!id) throw new Error('Achievement id is required');
      return getAchievement(id);
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: gamificationKeys.categories(),
    queryFn: listCategories,
    staleTime: 60_000,
  });
}

export function useCreateAchievement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AchievementCreatePayload) => createAchievement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gamificationKeys.achievements() });
      queryClient.invalidateQueries({ queryKey: gamificationKeys.categories() });
    },
  });
}

export function useUpdateAchievement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AchievementUpdatePayload }) =>
      updateAchievement(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: gamificationKeys.achievements() });
      queryClient.invalidateQueries({ queryKey: gamificationKeys.achievement(data.id) });
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CategoryCreatePayload) => createCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gamificationKeys.categories() });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CategoryUpdatePayload }) =>
      updateCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gamificationKeys.categories() });
    },
  });
}

export function useGrantsList(
  achievementId: string,
  params?: { visibility?: string; limit?: number },
) {
  return useInfiniteQuery({
    queryKey: gamificationKeys.grants(achievementId, params ?? {}),
    queryFn: ({ pageParam }) =>
      listGrants(achievementId, { ...params, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.nextCursor ? lastPage.nextCursor : undefined),
    enabled: Boolean(achievementId),
  });
}

export function useCreateGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ achievementId, payload }: { achievementId: string; payload: GrantCreatePayload }) =>
      createGrant(achievementId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: gamificationKeys.grants(variables.achievementId) });
    },
  });
}

export function useRevokeGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ grantId }: { grantId: string }) => revokeGrant(grantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gamificationKeys.all });
    },
  });
}
