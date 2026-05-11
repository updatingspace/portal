import { describe, expect, it } from 'vitest';

import { createAppRouter } from './routes';

type RouteNode = {
  index?: boolean;
  path?: string;
  children?: RouteNode[];
};

const findRouteByPath = (routes: RouteNode[], path: string): RouteNode | undefined => {
  for (const route of routes) {
    if (route.path === path) {
      return route;
    }
    if (route.children) {
      const child = findRouteByPath(route.children, path);
      if (child) {
        return child;
      }
    }
  }

  return undefined;
};

describe('app routes', () => {
  it('registers tenant entry points and tenant-aware app routes', () => {
    const router = createAppRouter();
    const routes = router.routes as RouteNode[];

    const tenantChooserRoute = findRouteByPath(routes, '/choose-tenant');
    const tenantRootRoute = findRouteByPath(routes, '/t/:tenantSlug');

    expect(tenantChooserRoute).toBeDefined();
    expect(tenantRootRoute).toBeDefined();

    const tenantAppLayout = tenantRootRoute?.children?.[0];
    expect(tenantAppLayout?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ index: true }),
        expect.objectContaining({ path: 'feed' }),
        expect.objectContaining({ path: 'voting' }),
        expect.objectContaining({ path: 'settings' }),
      ]),
    );
  });
});
