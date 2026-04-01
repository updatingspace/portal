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
  const PROFILE_ROUTES = [
    '/app/profile/following',
    '/app/profile/followers',
    '/app/profile/communities',
    '/app/profile/achievements',
    '/app/profile/friends',
  ] as const;

  it('registers all show-all profile routes', () => {
    const router = createAppRouter();
    const paths = collectPaths(router.routes as { path?: string; children?: unknown[] }[]);

    expect(paths).toEqual(expect.arrayContaining(PROFILE_ROUTES));
  });
});
