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
  it('registers all show-all profile routes', () => {
    const router = createAppRouter();
    const paths = collectPaths(router.routes as { path?: string; children?: unknown[] }[]);

    expect(paths).toContain('/app/profile/following');
    expect(paths).toContain('/app/profile/followers');
    expect(paths).toContain('/app/profile/communities');
    expect(paths).toContain('/app/profile/achievements');
    expect(paths).toContain('/app/profile/friends');
  });
});
