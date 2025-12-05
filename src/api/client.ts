import { getSessionToken } from './sessionToken';
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

const parseErrorMessage = async (response: Response) => {
  try {
    const data = await response.clone().json();
    if (typeof data?.detail === 'string') return data.detail;
    if (typeof data?.message === 'string') return data.message;
  } catch {
    /* ignore */
  }
  return null;
};

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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

  if (!response.ok) {
    const durationMs = Math.round(nowMs() - startedAt);
    const messageFromBody = await parseErrorMessage(response);
    const message = messageFromBody ?? `Запрос завершился с ошибкой (${response.status})`;
    const level =
      response.status >= 500
        ? 'critical'
        : response.status === 400
          ? 'info'
          : 'warn';
    logger[level]('API request returned error', {
      area: 'api',
      event: 'response_failed',
      data: {
        url: normalizedPath,
        method,
        status: response.status,
        duration_ms: durationMs,
      },
      error: messageFromBody ?? message,
    });

    throw new ApiError(message, {
      status: response.status,
      kind: statusToKind(response.status),
    });
  }

  logger.debug('API request completed', {
    area: 'api',
    event: 'response_ok',
    data: {
      url: normalizedPath,
      method,
      status: response.status,
      duration_ms: Math.round(nowMs() - startedAt),
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
