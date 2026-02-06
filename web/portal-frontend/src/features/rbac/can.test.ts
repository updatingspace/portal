import { describe, expect, it } from 'vitest';

import type { UserInfo } from '../../contexts/AuthContext';
import { can } from './can';

const baseUser: UserInfo = {
  id: 'u-1',
  username: 'u-1',
  email: 'u-1@example.com',
  isSuperuser: false,
  isStaff: false,
  displayName: 'User',
  tenant: { id: 'tenant-1', slug: 'aef' },
  capabilities: [],
  roles: [],
};

describe('can()', () => {
  it('accepts canonical permissions', () => {
    const user: UserInfo = { ...baseUser, capabilities: ['activity.feed.read'] };
    expect(can(user, 'activity.feed.read')).toBe(true);
  });

  it('accepts legacy aliases for backward compatibility', () => {
    const user: UserInfo = { ...baseUser, capabilities: ['feed:read'] };
    expect(can(user, 'activity.feed.read')).toBe(true);
  });

  it('keeps superuser bypass', () => {
    const user: UserInfo = { ...baseUser, isSuperuser: true };
    expect(can(user, 'portal.roles.read')).toBe(true);
  });
});
