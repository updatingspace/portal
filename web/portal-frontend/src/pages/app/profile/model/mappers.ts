import type { UserInfo } from '../../../../contexts/AuthContext';
import type { SessionMe } from '../../../../services/api';
import type { ActivityEvent } from '../../../../types/activity';
import type { Achievement } from '../../../../types/gamification';
import type { ProfileHubVM, ProfileWidgetPreviewItemVM } from './types';

const safeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const toPreviewItems = <T>(
  items: T[],
  mapper: (item: T, index: number) => ProfileWidgetPreviewItemVM,
): ProfileWidgetPreviewItemVM[] => items.slice(0, 8).map(mapper);

export const buildProfileHubVM = (params: {
  user: UserInfo;
  sessionInfo: SessionMe | null;
  feedItems: ActivityEvent[];
  hasMoreFeedItems: boolean;
  achievements: Achievement[];
  communities: { id: string; name: string; description?: string | null }[];
  capabilities: ProfileHubVM['capabilities'];
  routeBase: string;
}): ProfileHubVM => {
  const { user, sessionInfo, feedItems, hasMoreFeedItems, achievements, communities, capabilities, routeBase } = params;
  const idProfileUser = (sessionInfo?.id_profile?.user as Record<string, unknown> | undefined) ?? undefined;
  const portalProfile = (sessionInfo?.portal_profile as Record<string, unknown> | undefined) ?? undefined;

  const firstName =
    safeString(portalProfile?.first_name) ??
    safeString(portalProfile?.firstName) ??
    safeString(idProfileUser?.first_name) ??
    safeString(idProfileUser?.firstName);
  const lastName =
    safeString(portalProfile?.last_name) ??
    safeString(portalProfile?.lastName) ??
    safeString(idProfileUser?.last_name) ??
    safeString(idProfileUser?.lastName);

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const tenantDisplayName =
    fullName ||
    safeString(portalProfile?.display_name) ||
    safeString(portalProfile?.displayName) ||
    safeString(idProfileUser?.display_name) ||
    safeString(idProfileUser?.displayName) ||
    user.displayName ||
    user.username;

  return {
    viewer: {
      id: user.id,
      isSelf: true,
      permissions: capabilities,
    },
    owner: {
      id: user.id,
      tenantDisplayName,
      handle: user.username || safeString(idProfileUser?.username),
      avatarUrl: user.avatarUrl ?? undefined,
      bio: safeString(portalProfile?.bio),
      roleBadge: safeString((sessionInfo?.tenant_membership as Record<string, unknown> | undefined)?.base_role),
      statusBadge: safeString((sessionInfo?.tenant_membership as Record<string, unknown> | undefined)?.status),
    },
    stats: {
      // Dedicated profile stats endpoint is not available yet.
      // Keep numeric stats neutral to avoid presenting misleading counts.
      posts: 0,
      following: 0,
      followers: 0,
      communities: communities.length,
      achievements: achievements.length,
      friends: 0,
    },
    about: {
      language: user.language ?? undefined,
      timezone: safeString(idProfileUser?.timezone),
      contacts: user.email ? [user.email] : undefined,
    },
    previews: {
      achievements: toPreviewItems(achievements, (item) => ({
        id: item.id,
        title: item.nameI18n.ru ?? item.nameI18n.en ?? 'Без названия',
        subtitle: item.category || undefined,
        avatarUrl: item.images?.small ?? undefined,
        href: `${routeBase}/gamification/achievements/${item.id}`,
      })),
      following: [],
      followers: [],
      communities: toPreviewItems(communities, (item) => ({
        id: item.id,
        title: item.name,
        subtitle: item.description ?? undefined,
      })),
      friends: [],
    },
    feed: {
      items: feedItems,
      hasMore: hasMoreFeedItems,
    },
    capabilities,
  };
};
