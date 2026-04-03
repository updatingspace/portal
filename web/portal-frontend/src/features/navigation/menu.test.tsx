import { describe, expect, test } from 'vitest';

import { buildAsideMenuItems } from './menu';

const createUser = (overrides: Partial<Parameters<typeof buildAsideMenuItems>[0]['user']> = {}) => ({
  id: 'u-1',
  username: 'u-1',
  email: 'u-1@example.com',
  isSuperuser: false,
  isStaff: false,
  displayName: 'User',
  tenant: { id: 'tenant-1', slug: 'aef' },
  capabilities: [],
  roles: [],
  ...overrides,
});

const getMenuItems = (capabilities: string[] = [], isSuperuser = false) =>
  buildAsideMenuItems({
    user: createUser({ capabilities, isSuperuser }),
    currentPath: '/app',
    onNavigate: () => {},
  });

describe('navigation menu', () => {
  test('adds Admin item when user is superuser', () => {
    const items = getMenuItems([], true);

    expect(items.some((i) => i.id === 'admin')).toBe(true);
  });

  test.each([
    ['canonical capability', ['events.event.read']],
    ['legacy capability alias', ['events:read']],
  ])('shows events item for %s', (_name, capabilities) => {
    const items = getMenuItems(capabilities);

    expect(items.some((i) => i.id === 'events')).toBe(true);
  });

  test('hides voting item when voting capability is missing', () => {
    const items = getMenuItems(['events.event.read']);

    expect(items.some((i) => i.id === 'voting')).toBe(false);
  });
});
