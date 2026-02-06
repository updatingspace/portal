import { describe, expect, it } from 'vitest';

import { AccessDeniedError, toAccessDeniedError } from './accessDenied';

describe('accessDenied normalization', () => {
  it('normalizes 403 api error and extracts request id + service from payload', () => {
    const error = toAccessDeniedError(
      {
        status: 403,
        kind: 'forbidden',
        message: 'Denied by policy',
        details: {
          error: {
            request_id: 'req-500',
            service: 'voting',
          },
        },
      },
      {
        tenant: { slug: 'aef', id: 'tenant-uuid-1' },
      },
    );

    expect(error).toBeInstanceOf(AccessDeniedError);
    expect(error).toMatchObject({
      source: 'api',
      reason: 'Denied by policy',
      requestId: 'req-500',
      service: 'voting',
      tenant: { slug: 'aef', id: 'tenant-uuid-1' },
    });
  });

  it('returns null for non-403 errors', () => {
    const error = toAccessDeniedError({ status: 404, kind: 'not_found' });
    expect(error).toBeNull();
  });
});
