import { describe, expect, it, vi } from 'vitest';

import {
  ACCESS_DENIED_EVENT,
  AccessDeniedError,
  createClientAccessDeniedError,
  emitAccessDenied,
  subscribeAccessDenied,
  toAccessDeniedError,
} from './accessDenied';

describe('accessDenied business behavior', () => {
  it('creates client error with sanitized service and fallback reason', () => {
    const err = createClientAccessDeniedError({
      service: 'Portal_Service',
      requiredPermission: 'gamification.achievements.read',
    });

    expect(err).toBeInstanceOf(AccessDeniedError);
    expect(err.source).toBe('client');
    expect(err.service).toBe('portal_service');
    expect(err.requiredPermission).toBe('gamification.achievements.read');
  });

  it('maps forbidden-like API error and extracts request/service details', () => {
    const result = toAccessDeniedError({
      status: 403,
      message: 'Denied',
      details: {
        request_id: 'req-1',
        error: { service: 'access' },
      },
    });

    expect(result).not.toBeNull();
    expect(result?.requestId).toBe('req-1');
    expect(result?.service).toBe('access');
    expect(result?.reason).toBe('Denied');
  });

  it('returns null for non-forbidden errors', () => {
    expect(toAccessDeniedError({ status: 500, message: 'boom' })).toBeNull();
    expect(toAccessDeniedError({ kind: 'network' })).toBeNull();
    expect(toAccessDeniedError(null)).toBeNull();
  });

  it('emits and subscribes access denied events', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAccessDenied(listener);

    const err = new AccessDeniedError({ source: 'api', reason: 'Nope', path: '/app/x' });
    emitAccessDenied(err);

    expect(listener).toHaveBeenCalledTimes(1);
    const payload = listener.mock.calls[0][0] as AccessDeniedError;
    expect(payload.reason).toBe('Nope');

    unsubscribe();
    window.dispatchEvent(new CustomEvent(ACCESS_DENIED_EVENT, { detail: err }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('augment path when emitting error without path', () => {
    window.history.pushState({}, '', '/app/gamification?tab=all');
    const listener = vi.fn();
    const unsubscribe = subscribeAccessDenied(listener);

    const noPath = new AccessDeniedError({ source: 'api', reason: 'Denied', path: null });
    emitAccessDenied(noPath);

    expect(listener).toHaveBeenCalledTimes(1);
    const payload = listener.mock.calls[0][0] as AccessDeniedError;
    expect(payload.path).toContain('/app/gamification');

    unsubscribe();
  });
});
