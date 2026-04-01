import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import { ACCESS_DENIED_EVENT } from '../api/accessDenied';
import { toaster } from '../toaster';
import { notifyApiError } from './apiErrorHandling';

const createForbiddenApiError = () =>
  new ApiError('Forbidden from service', {
    status: 403,
    kind: 'forbidden',
    details: {
      error: {
        request_id: 'req-321',
        service: 'portal',
      },
    },
  });

const createServerApiError = () =>
  new ApiError('Server failed', {
    status: 500,
    kind: 'server',
  });

describe('notifyApiError', () => {
  let accessDeniedListener: EventListener = () => undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.removeEventListener(ACCESS_DENIED_EVENT, accessDeniedListener);
    accessDeniedListener = () => undefined;
  });

  it('returns forbidden kind for forbidden API errors', () => {
    const error = createForbiddenApiError();

    const kind = notifyApiError(error, 'Не удалось выполнить действие');

    expect(kind).toBe('forbidden');
  });

  it('skips raw toast for forbidden API errors', () => {
    const toasterSpy = vi.spyOn(toaster, 'add').mockImplementation(() => undefined);
    const error = createForbiddenApiError();

    notifyApiError(error, 'Не удалось выполнить действие');

    expect(toasterSpy).not.toHaveBeenCalled();
  });

  it('emits access denied event for forbidden API errors', async () => {
    const eventSpy = vi.fn();

    accessDeniedListener = eventSpy as EventListener;
    window.addEventListener(ACCESS_DENIED_EVENT, accessDeniedListener);

    const error = createForbiddenApiError();

    notifyApiError(error, 'Не удалось выполнить действие');

    expect(eventSpy).toHaveBeenCalledTimes(1);
  });

  it('shows toast for non-forbidden API errors', () => {
    const toasterSpy = vi.spyOn(toaster, 'add').mockImplementation(() => undefined);
    const error = createServerApiError();

    notifyApiError(error, 'Контекст');

    expect(toasterSpy).toHaveBeenCalledTimes(1);
  });
});
