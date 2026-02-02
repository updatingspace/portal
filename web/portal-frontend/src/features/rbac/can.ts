import type { UserInfo } from '../../contexts/AuthContext';

export type Capability = string;

export const can = (user: UserInfo | null, required?: Capability | Capability[]): boolean => {
  if (!required) return true;
  if (!user) return false;

  const requiredList = Array.isArray(required) ? required : [required];
  if (requiredList.length === 0) return true;

  const caps = user.capabilities ?? [];
  const roles = user.roles ?? [];

  // Superuser bypass (portal-level).
  if (user.isSuperuser) return true;

  return requiredList.every((r) => caps.includes(r) || roles.includes(r));
};
