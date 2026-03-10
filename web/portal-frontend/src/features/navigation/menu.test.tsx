import { describe, expect, test, vi } from 'vitest';

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

  // ---- routeBase tests (path-based multi-tenancy) ----

  test('uses /app as default routeBase', () => {
    const items = buildAsideMenuItems({
      user: {
        id: 'u1', username: 'u1', email: null, isSuperuser: false, isStaff: false, displayName: 'U',
        capabilities: [], roles: [],
      },
      currentPath: '/app',
      onNavigate: () => {},
    });

    const dashboard = items.find((i) => i.id === 'dashboard');
    expect(dashboard?.link).toBe('/app');
  });

  test('applies custom routeBase /t/aef to all items', () => {
    const items = buildAsideMenuItems({
      user: {
        id: 'u1', username: 'u1', email: null, isSuperuser: false, isStaff: false, displayName: 'U',
        capabilities: [], roles: [],
      },
      currentPath: '/t/aef',
      onNavigate: () => {},
      routeBase: '/t/aef',
    });

    const dashboard = items.find((i) => i.id === 'dashboard');
    expect(dashboard?.link).toBe('/t/aef');
  });

  test('routeBase applies to feed route', () => {
    const items = buildAsideMenuItems({
      user: {
        id: 'u1', username: 'u1', email: null, isSuperuser: false, isStaff: false, displayName: 'U',
        capabilities: ['activity.feed.read'], roles: [],
      },
      currentPath: '/t/aef/feed',
      onNavigate: () => {},
      routeBase: '/t/aef',
    });

    const feed = items.find((i) => i.id === 'feed');
    expect(feed?.link).toBe('/t/aef/feed');
    expect(feed?.current).toBe(true);
  });

  test('routeBase applies to admin route for superuser', () => {
    const items = buildAsideMenuItems({
      user: {
        id: 'u1', username: 'u1', email: null, isSuperuser: true, isStaff: false, displayName: 'U',
        capabilities: [], roles: [],
      },
      currentPath: '/t/beta/admin',
      onNavigate: () => {},
      routeBase: '/t/beta',
    });

    const admin = items.find((i) => i.id === 'admin');
    expect(admin?.link).toBe('/t/beta/admin');
    expect(admin?.current).toBe(true);
  });

  test('current is false when path does not match routeBase prefix', () => {
    const items = buildAsideMenuItems({
      user: {
        id: 'u1', username: 'u1', email: null, isSuperuser: false, isStaff: false, displayName: 'U',
        capabilities: ['activity.feed.read', 'events.event.read'], roles: [],
      },
      currentPath: '/t/aef/events',
      onNavigate: () => {},
      routeBase: '/t/aef',
    });

    const feed = items.find((i) => i.id === 'feed');
    expect(feed?.current).toBe(false);

    const events = items.find((i) => i.id === 'events');
    expect(events?.current).toBe(true);
  });

  test('onNavigate is invoked with full path including routeBase', () => {
    const onNavigate = vi.fn();
    const items = buildAsideMenuItems({
      user: {
        id: 'u1', username: 'u1', email: null, isSuperuser: false, isStaff: false, displayName: 'U',
        capabilities: ['activity.feed.read'], roles: [],
      },
      currentPath: '/t/aef',
      onNavigate,
      routeBase: '/t/aef',
    });

    const feed = items.find((i) => i.id === 'feed');
    feed?.onItemClick?.(feed, false, {} as MouseEvent);
    expect(onNavigate).toHaveBeenCalledWith('/t/aef/feed');
  });

  test('modified clicks are not intercepted', () => {
    const onNavigate = vi.fn();
    const items = buildAsideMenuItems({
      user: {
        id: 'u1', username: 'u1', email: null, isSuperuser: false, isStaff: false, displayName: 'U',
        capabilities: ['activity.feed.read'], roles: [],
      },
      currentPath: '/t/aef',
      onNavigate,
      routeBase: '/t/aef',
    });

    const feed = items.find((i) => i.id === 'feed');
    // Ctrl+Click
    feed?.onItemClick?.(feed, false, { ctrlKey: true } as MouseEvent);
    expect(onNavigate).not.toHaveBeenCalled();

    // Meta+Click (Cmd on macOS)
    feed?.onItemClick?.(feed, false, { metaKey: true } as MouseEvent);
    expect(onNavigate).not.toHaveBeenCalled();

    // Middle mouse button
    feed?.onItemClick?.(feed, false, { button: 1 } as MouseEvent);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
