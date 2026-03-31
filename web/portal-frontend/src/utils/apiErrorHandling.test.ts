import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import * as accessDeniedModule from '../api/accessDenied';
import { toaster } from '../toaster';
import { logger } from './logger';
import { getApiErrorMeta, isAuthIssue, notifyApiError } from './apiErrorHandling';

describe('apiErrorHandling business behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns metadata for known and unknown error kinds', () => {
    const networkMeta = getApiErrorMeta(new ApiError('network', { kind: 'network' }));
    expect(networkMeta).toMatchObject({ kind: 'network', title: 'Нет связи с API', theme: 'danger' });

    const unknownMeta = getApiErrorMeta(new Error('boom'));
    expect(unknownMeta).toMatchObject({ kind: 'unknown', title: 'Неизвестная ошибка', theme: 'danger' });
  });

  it('emits access denied and avoids toast when denied error is mapped', () => {
    const emitSpy = vi.spyOn(accessDeniedModule, 'emitAccessDenied').mockImplementation(() => undefined);
    const toasterSpy = vi.spyOn(toaster, 'add').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const error = new ApiError('Forbidden by policy', {
      status: 403,
      kind: 'forbidden',
      requestId: 'req-403',
      code: 'FORBIDDEN',
      details: { error: { request_id: 'req-403', service: 'access' } },
    });

    const result = notifyApiError(error, 'Невозможно обновить сущность');

    expect(result).toBe('forbidden');
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(toasterSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('shows toast for server error and appends request id hint once', () => {
    const toasterSpy = vi.spyOn(toaster, 'add').mockImplementation(() => undefined);
    const criticalSpy = vi.spyOn(logger, 'critical').mockImplementation(() => undefined);

    const error = new ApiError('Backend crashed hard', {
      status: 500,
      kind: 'server',
      requestId: 'req-500',
      code: 'SERVER_FAIL',
    });

    const result = notifyApiError(error, 'Ошибка синхронизации');

    expect(result).toBe('server');
    expect(toasterSpy).toHaveBeenCalledTimes(1);
    const payload = toasterSpy.mock.calls[0][0];
    expect(payload.title).toBe('Сервис недоступен');
    expect(payload.content).toContain('Ошибка синхронизации');
    expect(payload.content).toContain('Backend crashed hard');
    expect(payload.content).toContain('Request ID: req-500');
    expect(criticalSpy).toHaveBeenCalled();
  });

  it('does not duplicate server message if already included by context content', () => {
    const toasterSpy = vi.spyOn(toaster, 'add').mockImplementation(() => undefined);

    const error = new ApiError('Проверьте, запущен ли бэкенд и доступна ли сеть.', {
      status: 0,
      kind: 'network',
    });

    notifyApiError(error, 'Контекст');
    const content = toasterSpy.mock.calls[0][0].content as string;
    const first = content.indexOf('Проверьте, запущен ли бэкенд и доступна ли сеть.');
    const last = content.lastIndexOf('Проверьте, запущен ли бэкенд и доступна ли сеть.');
    expect(first).toBe(last);
  });

  it('supports empty context and non-api unknown errors', () => {
    const toasterSpy = vi.spyOn(toaster, 'add').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    const result = notifyApiError(new Error('unhandled'), '');

    expect(result).toBe('unknown');
    expect(toasterSpy).toHaveBeenCalledTimes(1);
    expect(toasterSpy.mock.calls[0][0].content).toContain('Что-то пошло не так');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('isAuthIssue matches unauthorized/forbidden only for ApiError', () => {
    expect(isAuthIssue(new ApiError('401', { kind: 'unauthorized', status: 401 }))).toBe(true);
    expect(isAuthIssue(new ApiError('403', { kind: 'forbidden', status: 403 }))).toBe(true);
    expect(isAuthIssue(new ApiError('500', { kind: 'server', status: 500 }))).toBe(false);
    expect(isAuthIssue(new Error('plain'))).toBe(false);
  });
});
