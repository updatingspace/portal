import type { UserInfo } from '../../contexts/AuthContext';

export type Capability = string;

const CAPABILITY_ALIASES: Record<string, string> = {
  'feed:read': 'activity.feed.read',
  'events:read': 'events.event.read',
  'voting:read': 'voting.votings.read',
};

const normalizeCapability = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return CAPABILITY_ALIASES[trimmed] ?? trimmed;
};

export const can = (user: UserInfo | null, required?: Capability | Capability[]): boolean => {
  if (!required) return true;
  if (!user) return false;

  const requiredList = (Array.isArray(required) ? required : [required])
    .map(normalizeCapability)
    .filter(Boolean);
  if (requiredList.length === 0) return true;

  const caps = (user.capabilities ?? []).map(normalizeCapability);
  const roles = (user.roles ?? []).map(normalizeCapability);

  // Superuser bypass (portal-level).
  if (user.isSuperuser) return true;

  return requiredList.every((r) => caps.includes(r) || roles.includes(r));
};
