import { describe, expect, it, vi } from 'vitest';

import { applyLegacyTenantAliasRedirect } from './legacyTenantAlias';

describe('applyLegacyTenantAliasRedirect', () => {
  it('redirects legacy tenant app routes before app bootstrap', () => {
    const replace = vi.fn();

    const redirected = applyLegacyTenantAliasRedirect(
      {
        protocol: 'http:',
        host: 'aef.localhost',
        pathname: '/app',
        search: '',
        hash: '',
      },
      replace,
    );

    expect(redirected).toBe(true);
    expect(replace).toHaveBeenCalledWith('http://portal.localhost/t/aef/');
  });

  it('does nothing on canonical portal host', () => {
    const replace = vi.fn();

    const redirected = applyLegacyTenantAliasRedirect(
      {
        protocol: 'http:',
        host: 'portal.localhost',
        pathname: '/app',
        search: '',
        hash: '',
      },
      replace,
    );

    expect(redirected).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });
});
