import { describe, expect, it } from 'vitest';

import type { UserInfo } from '../../contexts/AuthContext';
import { buildAsideMenuItems } from './menu';

const tenantAdminUser: UserInfo = {
  id: 'user-1',
  username: 'moderator',
  email: 'moderator@example.com',
  isSuperuser: true,
  isStaff: true,
  displayName: 'Moderator',
  capabilities: [
    'activity.feed.read',
    'events.event.read',
    'voting.poll.read',
    'gamification.achievements.read',
    'portal.roles.read',
  ],
};

describe('buildAsideMenuItems', () => {
  it('uses tenant route base for generated links and navigation', () => {
    const onNavigateCalls: string[] = [];

    const items = buildAsideMenuItems({
      user: tenantAdminUser,
      currentPath: '/t/aef/voting',
      onNavigate: (to) => onNavigateCalls.push(to),
      routeBase: '/t/aef',
    });

    expect(items.map((item) => item.link)).toEqual(
      expect.arrayContaining([
        '/t/aef',
        '/t/aef/feed',
        '/t/aef/voting',
        '/t/aef/tenant-admin',
        '/t/aef/admin',
        '/t/aef/feature-flags',
      ]),
    );

    items.find((item) => item.id === 'voting')?.onItemClick?.(
      { id: 'voting', title: 'Voting' },
      false,
      { preventDefault() {} },
    );

    expect(onNavigateCalls).toContain('/t/aef/voting');
  });
});
