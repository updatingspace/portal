import { describe, expect, it } from 'vitest';

import {
  getLegacyTenantAliasRedirectUrl,
  getPortalHostForTenantAlias,
  getTenantAliasFromHost,
  getTenantFromHost,
  toCanonicalTenantPath,
} from './tenant';

describe('tenant host helpers', () => {
  it('maps legacy /app routes to canonical tenant paths', () => {
    expect(toCanonicalTenantPath('/app/feed?x=1#focus', 'aef')).toBe('/t/aef/feed?x=1#focus');
    expect(toCanonicalTenantPath('/app', 'aef')).toBe('/t/aef/');
  });

  it('builds canonical portal URL for legacy tenant hosts', () => {
    expect(
      getLegacyTenantAliasRedirectUrl({
        protocol: 'http:',
        host: 'aef.localhost',
        pathname: '/app/events/42',
        search: '?tab=details',
        hash: '#rsvp',
      }),
    ).toBe('http://portal.localhost/t/aef/events/42?tab=details#rsvp');
  });

  it('canonicalizes alias-host login route to portal login with tenant next path', () => {
    expect(
      getLegacyTenantAliasRedirectUrl({
        protocol: 'http:',
        host: 'aef.localhost',
        pathname: '/login',
        search: '?next=%2Fapp%2Ffeed%3Fx%3D1',
        hash: '',
      }),
    ).toBe('http://portal.localhost/login?next=%2Ft%2Faef%2Ffeed%3Fx%3D1');
  });

  it('does not treat portal host or direct localhost as tenant aliases', () => {
    expect(getTenantAliasFromHost('portal.localhost')).toBeNull();
    expect(getLegacyTenantAliasRedirectUrl({
      protocol: 'http:',
      host: 'portal.localhost',
      pathname: '/app',
      search: '',
      hash: '',
    })).toBeNull();
    expect(getTenantFromHost('localhost:5173')).toBeNull();
  });

  it('preserves explicit tenant alias host and derives portal host with port', () => {
    expect(getTenantAliasFromHost('aef.localhost:5173')).toEqual({
      slug: 'aef',
      host: 'aef.localhost:5173',
    });
    expect(getPortalHostForTenantAlias('aef.localhost:5173')).toBe('portal.localhost:5173');
  });
});
