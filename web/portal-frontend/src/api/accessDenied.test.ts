import { describe, expect, it } from 'vitest';

import { AccessDeniedError, toAccessDeniedError } from './accessDenied';

const tenantContext = {
  tenant: { slug: 'aef', id: 'tenant-uuid-1' },
};

const forbiddenApiError = {
  status: 403,
  kind: 'forbidden',
  message: 'Denied by policy',
  details: {
    error: {
      request_id: 'req-500',
      service: 'voting',
    },
  },
};

describe('accessDenied normalization', () => {
  it('returns AccessDeniedError instance for 403 api error', () => {
    const error = toAccessDeniedError(forbiddenApiError, tenantContext);

    expect(error).toBeInstanceOf(AccessDeniedError);
  });

  it('extracts request id, service and tenant from 403 api payload', () => {
    const error = toAccessDeniedError(forbiddenApiError, tenantContext);

    expect(error).toMatchObject({
      source: 'api',
      reason: 'Denied by policy',
      requestId: 'req-500',
      service: 'voting',
      tenant: { slug: 'aef', id: 'tenant-uuid-1' },
    });
  });

  it.each([
    { status: 404, kind: 'not_found' },
    { status: 401, kind: 'unauthorized' },
    { status: 500, kind: 'server_error' },
  ])('returns null for non-403 errors: %p', (input) => {
    const error = toAccessDeniedError(input);
    expect(error).toBeNull();
  });
});
