import { clearSessionToken, getSessionToken } from './sessionToken';
import { logger } from '../utils/logger';

export type ApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'server'
  | 'unknown';

const DEFAULT_API_BASE_URL = 'http://localhost:8000/api';
const rawBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '__VITE_API_BASE_URL__';
const normalizedEnvBase =
  rawBaseUrl === '__VITE_API_BASE_URL__' ? undefined : rawBaseUrl?.replace(/\/$/, '');
const baseUrl = (normalizedEnvBase ?? rawBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');
export const apiBaseUrl = baseUrl;

const withLeadingSlash = (path: string) =>
  path.startsWith('/') ? path : `/${path}`;

const nowMs = () =>
  typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();

export class ApiError extends Error {
  public status?: number;
  public kind: ApiErrorKind;
  public details?: unknown;

  constructor(message: string, options: { status?: number; kind: ApiErrorKind; details?: unknown; cause?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.kind = options.kind;
    this.details = options.details;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

const statusToKind = (status: number): ApiErrorKind => {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status >= 500) return 'server';
  return 'unknown';
};

type ErrorPayload = {
  detail?: unknown;
  message?: unknown;
  errors?: Record<string, unknown>;
  fields?: Record<string, unknown>;
};

export const extractApiErrorMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as ErrorPayload;

  if (data.fields && typeof data.fields === 'object') {
    for (const value of Object.values(data.fields)) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }

  if (data.errors && typeof data.errors === 'object') {
    for (const entry of Object.values(data.errors)) {
      if (!Array.isArray(entry)) continue;
      for (const item of entry) {
        if (typeof item === 'string' && item.trim()) return item.trim();
        if (
          item &&
          typeof item === 'object' &&
          'message' in item &&
          typeof (item as { message?: unknown }).message === 'string'
        ) {
          const msg = (item as { message?: string }).message;
          if (msg?.trim()) return msg.trim();
        }
      }
    }
  }

  if (typeof data.detail === 'string' && data.detail.trim()) return data.detail.trim();
  if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  return null;
};

const parseErrorMessage = async (
  response: Response,
): Promise<{ message: string | null; details: ErrorPayload | null }> => {
  try {
    const data = await response.clone().json();
    return { message: extractApiErrorMessage(data), details: data as ErrorPayload };
  } catch {
    /* ignore */
  }
  return { message: null, details: null };
};

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Additional codes to treat as business (non-throw) errors */
  treatAsBusiness?: string[];
  /** Do not auto-clear session tokens on 401 */
  skipAuthClear?: boolean;
};

export type BusinessError = {
  code?: string;
  message?: string;
  details?: unknown;
};

export type ApiResponse<T> =
  | { ok: true; status: number; data: T; headers: Headers; durationMs: number }
  | { ok: false; status: number; error: BusinessError; headers: Headers; durationMs: number };

const BUSINESS_CODES = new Set([
  'INVALID_CREDENTIALS',
  'INVALID_OR_EXPIRED_TOKEN',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'MFA_REQUIRED',
  'LOGIN_RATE_LIMITED',
  'REGISTER_RATE_LIMITED',
  'INVALID_FORM_TOKEN',
  'EMAIL_ALREADY_EXISTS',
  'VALIDATION_ERROR',
]);

const isBusinessCase = (status: number, code: string | undefined, extra?: string[]) => {
  const codeUpper = code?.toUpperCase();
  if (!codeUpper && !extra?.length) return false;
  const isKnown = codeUpper ? BUSINESS_CODES.has(codeUpper) : false;
  const isExtra = codeUpper && extra?.some((c) => c.toUpperCase() === codeUpper);
  const businessStatus = status === 400 || status === 401 || status === 403 || status === 409 || status === 429;
  return businessStatus && (isKnown || isExtra || Boolean(codeUpper));
};

export async function requestResult<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const normalizedPath = withLeadingSlash(path);
  const url = `${baseUrl}${normalizedPath}`;
  const sessionToken = getSessionToken();
  const method = (options.method ?? 'GET').toUpperCase();
  const startedAt = nowMs();

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
        ...(options.headers ?? {}),
      },
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    logger.error('API request failed: network error', {
      area: 'api',
      event: 'request_failed',
      data: { url: normalizedPath, method },
      error,
    });
    throw new ApiError('Не удалось подключиться к API', {
      kind: 'network',
      cause: error,
    });
  }

  const durationMs = Math.round(nowMs() - startedAt);
  const { message: messageFromBody, details } = await parseErrorMessage(response);
  const codeFromBody =
    details && typeof details === 'object' && typeof (details as { code?: unknown }).code === 'string'
      ? ((details as { code?: string }).code as string)
      : undefined;
  const message = messageFromBody ?? `Запрос завершился с ошибкой (${response.status})`;

  if (response.ok) {
    logger.debug('API request completed', {
      area: 'api',
      event: 'response_ok',
      data: {
        url: normalizedPath,
        method,
        status: response.status,
        duration_ms: durationMs,
      },
    });

    if (response.status === 204) {
      return { ok: true, status: response.status, data: undefined as T, headers: response.headers, durationMs };
    }

    const data = (await response.json()) as T;
    return { ok: true, status: response.status, data, headers: response.headers, durationMs };
  }

  const businessCase = isBusinessCase(response.status, codeFromBody, options.treatAsBusiness);
  if (businessCase) {
    if (response.status === 401 && codeFromBody === 'INVALID_OR_EXPIRED_TOKEN' && !options.skipAuthClear) {
      clearSessionToken();
    }
    const level = response.status === 401 ? 'info' : response.status === 403 ? 'warn' : 'info';
    logger[level]('API request returned business error', {
      area: 'api',
      event: 'response_business_error',
      data: { url: normalizedPath, method, status: response.status, duration_ms: durationMs, code: codeFromBody },
      error: message,
    });
    return {
      ok: false,
      status: response.status,
      error: { code: codeFromBody, message, details },
      headers: response.headers,
      durationMs,
    };
  }

  if (response.status >= 500) {
    logger.critical('API request returned server error', {
      area: 'api',
      event: 'response_failed',
      data: { url: normalizedPath, method, status: response.status, duration_ms: durationMs },
      error: message,
    });
    throw new ApiError(message, {
      status: response.status,
      kind: 'server',
      details,
    });
  }

  logger.warn('API request returned error', {
    area: 'api',
    event: 'response_failed',
    data: { url: normalizedPath, method, status: response.status, duration_ms: durationMs },
    error: message,
  });
  throw new ApiError(message, {
    status: response.status,
    kind: statusToKind(response.status),
    details,
  });
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const result = await requestResult<T>(path, options);
  if (!result.ok) {
    throw new ApiError(result.error.message ?? `Запрос завершился с ошибкой (${result.status})`, {
      status: result.status,
      kind: statusToKind(result.status),
      details: result.error.details,
    });
  }
  return result.data;
}
