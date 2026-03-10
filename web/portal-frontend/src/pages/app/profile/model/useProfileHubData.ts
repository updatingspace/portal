import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useRouteBase } from '../../../../shared/hooks/useRouteBase';

import { isApiError } from '../../../../api/client';
import { listAchievements } from '../../../../api/gamification';
import { useFeedInfinite } from '../../../../hooks/useActivity';
import { useAuth } from '../../../../contexts/AuthContext';
import { fetchPortalCommunities } from '../../../../modules/portal/api';
import type { SessionMe } from '../../../../services/api';
import { hasProfilePermission } from './permissions';
import { buildProfileHubVM } from './mappers';
import type { ProfileHubVM } from './types';

type UseProfileHubDataResult = {
  vm: ProfileHubVM | null;
  isLoading: boolean;
  isFeedLoading: boolean;
  feedError: Error | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetchFeed: () => Promise<unknown>;
};

export const useProfileHubData = (sessionInfo: SessionMe | null): UseProfileHubDataResult => {
  const { user } = useAuth();
  const routeBase = useRouteBase();

  const capabilities = useMemo<ProfileHubVM['capabilities']>(() => {
    return {
      canViewProfile: hasProfilePermission(user, 'profile.view'),
      canCreatePost: hasProfilePermission(user, 'post.create'),
      canViewPosts: hasProfilePermission(user, 'post.view'),
      canEditProfile: Boolean(user && (user.isSuperuser || user.id === sessionInfo?.user?.id)),
      canFollow: hasProfilePermission(user, 'follow.create') || hasProfilePermission(user, 'follow.delete'),
      canMessage: hasProfilePermission(user, 'message.send'),
    };
  }, [sessionInfo?.user?.id, user]);

  const feedQuery = useFeedInfinite(
    {
      limit: 20,
    },
    {
      enabled: Boolean(user && capabilities.canViewPosts),
    },
  );

  const achievementsQuery = useQuery({
    queryKey: ['profile-hub', 'achievements-preview'],
    queryFn: async () => {
      try {
        const response = await listAchievements({ limit: 8 });
        return response.items;
      } catch (error) {
        if (isApiError(error) && (error.kind === 'forbidden' || error.kind === 'not_found')) {
          return [];
        }
        throw error;
      }
    },
    retry: false,
  });

  const communitiesQuery = useQuery({
    queryKey: ['profile-hub', 'communities-preview'],
    queryFn: async () => {
      try {
        return await fetchPortalCommunities();
      } catch (error) {
        if (isApiError(error) && (error.kind === 'forbidden' || error.kind === 'not_found')) {
          return [];
        }
        throw error;
      }
    },
    retry: false,
  });

  const feedItems = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [feedQuery.data?.pages],
  );

  const vm = useMemo(() => {
    if (!user) return null;
    return buildProfileHubVM({
      user,
      sessionInfo,
      feedItems,
      hasMoreFeedItems: Boolean(feedQuery.hasNextPage),
      achievements: achievementsQuery.data ?? [],
      communities: communitiesQuery.data ?? [],
      capabilities,
      routeBase,
    });
  }, [
    achievementsQuery.data,
    capabilities,
    communitiesQuery.data,
    feedItems,
    feedQuery.hasNextPage,
    routeBase,
    sessionInfo,
    user,
  ]);

  return {
    vm,
    isLoading: feedQuery.isLoading || achievementsQuery.isLoading || communitiesQuery.isLoading,
    isFeedLoading: feedQuery.isLoading,
    feedError: (feedQuery.error as Error | null) ?? null,
    hasNextPage: Boolean(feedQuery.hasNextPage),
    isFetchingNextPage: feedQuery.isFetchingNextPage,
    fetchNextPage: feedQuery.fetchNextPage,
    refetchFeed: feedQuery.refetch,
  };
};
