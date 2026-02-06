import type { ActivityEvent } from '../../../../types/activity';

export type ProfileCapabilitiesVM = {
  canEditProfile: boolean;
  canCreatePost: boolean;
  canViewPosts: boolean;
  canFollow: boolean;
  canMessage: boolean;
  canViewProfile: boolean;
};

export type ProfileOwnerVM = {
  id: string;
  tenantDisplayName: string;
  handle?: string;
  avatarUrl?: string;
  bio?: string;
  roleBadge?: string;
  statusBadge?: string;
};

export type ProfileStatsVM = {
  posts: number;
  following: number;
  followers: number;
  communities: number;
  achievements: number;
  friends?: number;
};

export type ProfileWidgetPreviewItemVM = {
  id: string;
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  href?: string;
};

export type ProfileFeedItemVM = ActivityEvent;

export type ProfileHubVM = {
  viewer: {
    id: string;
    isSelf: boolean;
    permissions: ProfileCapabilitiesVM;
  };
  owner: ProfileOwnerVM;
  stats: ProfileStatsVM;
  about: {
    location?: string;
    language?: string;
    timezone?: string;
    website?: string;
    contacts?: string[];
  };
  previews: {
    achievements: ProfileWidgetPreviewItemVM[];
    following: ProfileWidgetPreviewItemVM[];
    followers: ProfileWidgetPreviewItemVM[];
    communities: ProfileWidgetPreviewItemVM[];
    friends: ProfileWidgetPreviewItemVM[];
  };
  feed: {
    items: ProfileFeedItemVM[];
    hasMore: boolean;
  };
  capabilities: ProfileCapabilitiesVM;
};
