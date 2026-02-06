import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import { ACCESS_DENIED_EVENT } from '../api/accessDenied';
import { toaster } from '../toaster';
import { notifyApiError } from './apiErrorHandling';

describe('notifyApiError', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('emits access denied event and skips raw toast for forbidden errors', async () => {
    const toasterSpy = vi.spyOn(toaster, 'add').mockImplementation(() => undefined);
    const eventSpy = vi.fn();

    window.addEventListener(ACCESS_DENIED_EVENT, eventSpy as EventListener);

    const error = new ApiError('Forbidden from service', {
      status: 403,
      kind: 'forbidden',
      details: {
        error: {
          request_id: 'req-321',
          service: 'portal',
        },
      },
    });

    const kind = notifyApiError(error, 'Не удалось выполнить действие');

    expect(kind).toBe('forbidden');
    expect(toasterSpy).not.toHaveBeenCalled();
    expect(eventSpy).toHaveBeenCalledTimes(1);

    window.removeEventListener(ACCESS_DENIED_EVENT, eventSpy as EventListener);
  });

  it('shows toast for non-forbidden errors', () => {
    const toasterSpy = vi.spyOn(toaster, 'add').mockImplementation(() => undefined);
    const error = new ApiError('Server failed', {
      status: 500,
      kind: 'server',
    });

    notifyApiError(error, 'Контекст');

    expect(toasterSpy).toHaveBeenCalledTimes(1);
  });
});
