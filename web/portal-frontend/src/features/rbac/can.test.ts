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
  it.each([
    ['canonical capability', ['activity.feed.read']],
    ['legacy alias', ['feed:read']],
  ])('allows access when user has %s', (_label, capabilities) => {
    const user: UserInfo = { ...baseUser, capabilities };
    expect(can(user, 'activity.feed.read')).toBe(true);
  });

  it('keeps superuser bypass for any permission', () => {
    const user: UserInfo = { ...baseUser, isSuperuser: true };
    expect(can(user, 'portal.roles.read')).toBe(true);
  });

  it.each([
    ['missing capability', [], 'activity.feed.read'],
    ['unknown capability', ['portal.roles.read'], 'activity.feed.read'],
  ])('denies access for %s', (_label, capabilities, permission) => {
    const user: UserInfo = { ...baseUser, capabilities };
    expect(can(user, permission)).toBe(false);
  });
});
