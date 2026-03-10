import { describe, expect, it } from 'vitest';

import { createAppRouter } from '../../../app/routes';

const collectPaths = (routes: { path?: string; children?: unknown[] }[]): string[] => {
  const paths: string[] = [];
  routes.forEach((route) => {
    if (route.path) {
      paths.push(route.path);
    }
    if (Array.isArray(route.children)) {
      paths.push(...collectPaths(route.children as { path?: string; children?: unknown[] }[]));
    }
  });
  return paths;
};

describe('Profile hub routes', () => {
  it('registers all show-all profile routes under /t/:tenantSlug', () => {
    const router = createAppRouter();
    const paths = collectPaths(router.routes as { path?: string; children?: unknown[] }[]);

    // Path-based tenant routes: profile sub-routes are relative children of /t/:tenantSlug
    expect(paths).toContain('profile/following');
    expect(paths).toContain('profile/followers');
    expect(paths).toContain('profile/communities');
    expect(paths).toContain('profile/achievements');
    expect(paths).toContain('profile/friends');
  });
});
