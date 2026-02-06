import type { UserInfo } from '../../../../contexts/AuthContext';
import { can } from '../../../../features/rbac/can';

export type ProfileSemanticPermission =
  | 'profile.view'
  | 'post.create'
  | 'post.view'
  | 'follow.create'
  | 'follow.delete'
  | 'message.send';

const semanticMap: Record<ProfileSemanticPermission, string[]> = {
  'profile.view': ['portal.profile.read_self', 'activity.feed.read'],
  'post.create': ['activity.news.create'],
  'post.view': ['activity.feed.read'],
  'follow.create': ['portal.follow.create'],
  'follow.delete': ['portal.follow.delete'],
  'message.send': ['portal.messages.send'],
};

export const hasProfilePermission = (user: UserInfo | null, permission: ProfileSemanticPermission): boolean => {
  const mapped = semanticMap[permission] ?? [];
  return mapped.some((entry) => can(user, entry));
};
