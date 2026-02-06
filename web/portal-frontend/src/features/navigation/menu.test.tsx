import { describe, expect, test } from 'vitest';

import { buildAsideMenuItems } from './menu';

describe('navigation menu', () => {
  test('adds Admin item for superuser', () => {
    const items = buildAsideMenuItems({
      user: {
        id: 'root',
        username: 'root',
        email: 'root@example.com',
        isSuperuser: true,
        isStaff: false,
        displayName: 'Root',
        tenant: { id: 'tenant-1', slug: 'aef' },
        capabilities: [],
        roles: [],
      },
      currentPath: '/app',
      onNavigate: () => {},
    });

    expect(items.some((i) => i.id === 'admin')).toBe(true);
  });

  test('filters capability-gated items when canonical capabilities are present', () => {
    const items = buildAsideMenuItems({
      user: {
        id: 'u1',
        username: 'u1',
        email: 'u1@example.com',
        isSuperuser: false,
        isStaff: false,
        displayName: 'User',
        tenant: { id: 'tenant-1', slug: 'aef' },
        capabilities: ['events.event.read'],
      },
      currentPath: '/app',
      onNavigate: () => {},
    });

    expect(items.some((i) => i.id === 'events')).toBe(true);
    expect(items.some((i) => i.id === 'voting')).toBe(false);
  });

  test('supports legacy capability aliases for compatibility', () => {
    const items = buildAsideMenuItems({
      user: {
        id: 'u2',
        username: 'u2',
        email: 'u2@example.com',
        isSuperuser: false,
        isStaff: false,
        displayName: 'User 2',
        tenant: { id: 'tenant-1', slug: 'aef' },
        capabilities: ['events:read'],
      },
      currentPath: '/app',
      onNavigate: () => {},
    });

    expect(items.some((i) => i.id === 'events')).toBe(true);
  });
});
