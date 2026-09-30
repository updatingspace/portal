import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useRouteBase } from '../../../../shared/hooks/useRouteBase';

import { listAchievements } from '../../../../api/gamification';
import { useFeedInfinite } from '../../../../hooks/useActivity';
import { useAuth } from '../../../../contexts/AuthContext';
import { fetchEntryMe } from '../../../../api/tenant';
import type { SessionMe } from '../../../../services/api';
import { hasProfilePermission } from './permissions';
import { buildProfileHubVM } from './mappers';
import type { ProfileHubVM } from './types';

type UseProfileHubDataResult = {
  vm: ProfileHubVM | null;
  isLoading: boolean;
  isFeedLoading: boolean;
  feedError: Error | null;
  achievementsError: boolean;
  communitiesError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetchFeed: () => Promise<unknown>;
};

export const useProfileHubData = (
  sessionInfo: SessionMe | null,
  { loadPreviews = true }: { loadPreviews?: boolean } = {},
): UseProfileHubDataResult => {
  const { user } = useAuth();
  const routeBase = useRouteBase();

  const capabilities = useMemo<ProfileHubVM['capabilities']>(() => {
    return {
      canViewProfile: hasProfilePermission(user, 'profile.view'),
      canCreatePost: hasProfilePermission(user, 'post.create'),
      canViewPosts: hasProfilePermission(user, 'post.view'),
      canEditProfile: Boolean(
        user && (user.isSuperuser || user.id === sessionInfo?.user?.id),
      ),
      canFollow:
        hasProfilePermission(user, 'follow.create') ||
        hasProfilePermission(user, 'follow.delete'),
      canMessage: hasProfilePermission(user, 'message.send'),
    };
  }, [sessionInfo?.user?.id, user]);

  const feedQuery = useFeedInfinite(
    {
      limit: 20,
      actorUserId: user?.id,
    },
    {
      enabled: Boolean(user && capabilities.canViewPosts),
    },
  );

  const achievementsQuery = useQuery({
    queryKey: [
      'profile-hub',
      user?.tenant?.id,
      user?.id,
      'achievements-preview',
    ],
    queryFn: async () =>
      (await listAchievements({ limit: 8, earned: true })).items,
    enabled: Boolean(user && loadPreviews),
    retry: false,
  });

  const communitiesQuery = useQuery({
    queryKey: ['profile-hub', user?.id, 'communities-preview'],
    queryFn: async () =>
      (await fetchEntryMe()).memberships
        .filter((item) => item.status === 'active')
        .map((item) => ({
          id: item.tenant_id,
          name: item.display_name || item.tenant_slug,
        })),
    enabled: Boolean(user && loadPreviews),
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
    achievementsError: achievementsQuery.isError,
    communitiesError: communitiesQuery.isError,
    isLoading: !user,
    isFeedLoading: feedQuery.isLoading,
    feedError: (feedQuery.error as Error | null) ?? null,
    hasNextPage: Boolean(feedQuery.hasNextPage),
    isFetchingNextPage: feedQuery.isFetchingNextPage,
    fetchNextPage: feedQuery.fetchNextPage,
    refetchFeed: feedQuery.refetch,
  };
};
