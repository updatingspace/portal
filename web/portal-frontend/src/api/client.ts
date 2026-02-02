import { logger } from '../utils/logger';

export type ApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'server'
  | 'unknown';

const DEFAULT_API_BASE_URL = '/api/v1';
const DEFAULT_CSRF_COOKIE = 'updspace_csrf';
const DEFAULT_CSRF_HEADER = 'X-CSRF-Token';
const rawBaseUrl =
  (import.meta.env.VITE_BFF_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  '__VITE_API_BASE_URL__';

const normalizedEnvBase =
  rawBaseUrl === '__VITE_API_BASE_URL__' ? undefined : rawBaseUrl?.replace(/\/$/, '');

// Important: if we didn't get a real env value, fall back to DEFAULT_API_BASE_URL
// (and let Vite dev server proxy /api/v1 to BFF in local dev).
const baseUrl = (normalizedEnvBase ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');
const csrfCookieName =
  (import.meta.env.VITE_BFF_CSRF_COOKIE_NAME as string | undefined) ?? DEFAULT_CSRF_COOKIE;
const csrfHeaderName =
  (import.meta.env.VITE_BFF_CSRF_HEADER_NAME as string | undefined) ?? DEFAULT_CSRF_HEADER;

const getCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.trim().split('=');
    if (cookieName === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
};

const getCsrfToken = () => getCookieValue(csrfCookieName);
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
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
  public requestId?: string;
  public code?: string;

  constructor(
    message: string,
    options: {
      status?: number;
      kind: ApiErrorKind;
      details?: unknown;
      requestId?: string;
      code?: string;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.kind = options.kind;
    this.details = options.details;
    this.requestId = options.requestId;
    this.code = options.code;
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
  error?: {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    request_id?: unknown;
  };
  request_id?: unknown;
  detail?: unknown;
  message?: unknown;
  errors?: Record<string, unknown>;
  fields?: Record<string, unknown>;
};

export const extractApiRequestId = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as ErrorPayload;
  const fromEnvelope = data.error?.request_id;
  if (typeof fromEnvelope === 'string' && fromEnvelope.trim()) return fromEnvelope.trim();
  if (typeof data.request_id === 'string' && data.request_id.trim()) return data.request_id.trim();
  return null;
};

export const extractApiErrorCode = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as ErrorPayload;
  const fromEnvelope = data.error?.code;
  if (typeof fromEnvelope === 'string' && fromEnvelope.trim()) return fromEnvelope.trim();
  const legacy = (data as { code?: unknown }).code;
  if (typeof legacy === 'string' && legacy.trim()) return legacy.trim();
  return null;
};

export const extractApiErrorMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as ErrorPayload;

  // Unified UpdSpace error envelope
  if (data.error && typeof data.error === 'object') {
    const msg = (data.error as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }

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
  /** Retry configuration for network/server errors */
  retry?: {
    /** Maximum number of retry attempts (default: 3) */
    maxAttempts?: number;
    /** Base delay in ms between retries (default: 1000) */
    baseDelayMs?: number;
    /** Whether to retry on server errors (5xx) (default: true) */
    retryServerErrors?: boolean;
  };
  /** Disable automatic retry (default: false) */
  noRetry?: boolean;
};

const ensureRequestId = () => {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const calculateBackoffDelay = (attempt: number, baseDelayMs: number): number => {
  // Exponential backoff: 1s, 2s, 4s... with jitter
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 200; // Up to 200ms jitter
  return Math.min(exponentialDelay + jitter, 10000); // Cap at 10s
};

const shouldRetry = (
  error: unknown,
  response: Response | null,
  retryServerErrors: boolean,
): boolean => {
  // Retry on network errors
  if (error && !response) {
    return true;
  }
  // Retry on server errors if enabled
  if (response && response.status >= 500 && retryServerErrors) {
    return true;
  }
  return false;
};

export async function requestResult<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const normalizedPath = withLeadingSlash(path);
  const url = `${baseUrl}${normalizedPath}`;
  const method = (options.method ?? 'GET').toUpperCase();
  const shouldIncludeCsrf = !CSRF_SAFE_METHODS.has(method);
  const csrfToken = shouldIncludeCsrf ? getCsrfToken() : null;
  const csrfHeaders = csrfToken ? { [csrfHeaderName]: csrfToken } : null;
  const startedAt = nowMs();
  const requestId = ensureRequestId();

  // Retry configuration
  const retryEnabled = !options.noRetry;
  const maxAttempts = options.retry?.maxAttempts ?? 3;
  const baseDelayMs = options.retry?.baseDelayMs ?? 1000;
  const retryServerErrors = options.retry?.retryServerErrors ?? true;

  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = calculateBackoffDelay(attempt - 1, baseDelayMs);
      logger.info('Retrying API request', {
        area: 'api',
        event: 'request_retry',
        data: { url: normalizedPath, method, attempt, delay_ms: Math.round(delay) },
      });
      await sleep(delay);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          ...(csrfHeaders ?? {}),
          ...(options.headers ?? {}),
        },
        credentials: 'include',
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (error) {
      lastError = error as Error;
      lastResponse = null;

      if (retryEnabled && attempt < maxAttempts - 1) {
        logger.warn('API request failed, will retry', {
          area: 'api',
          event: 'request_failed_retry',
          data: { url: normalizedPath, method, attempt },
          error,
        });
        continue;
      }

      logger.error('API request failed: network error', {
        area: 'api',
        event: 'request_failed',
        data: { url: normalizedPath, method, attempts: attempt + 1 },
        error,
      });
      throw new ApiError('Не удалось подключиться к API', {
        kind: 'network',
        cause: error,
        requestId,
      });
    }

    lastResponse = response;
    lastError = null;

    const durationMs = Math.round(nowMs() - startedAt);
    const { message: messageFromBody, details } = await parseErrorMessage(response);
    const codeFromBody = extractApiErrorCode(details) ?? undefined;
    const requestIdFromBody = extractApiRequestId(details) ?? undefined;
    const reqIdHeader = response.headers.get('x-request-id');
    const requestIdFromHeader = reqIdHeader ?? undefined;
    const responseRequestId = requestIdFromBody ?? requestIdFromHeader ?? requestId;
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
          attempts: attempt + 1,
        },
      });

      if (response.status === 204) {
        return {
          ok: true,
          status: response.status,
          data: undefined as T,
          headers: response.headers,
          durationMs,
        };
      }

      const data = (await response.json()) as T;
      return { ok: true, status: response.status, data, headers: response.headers, durationMs };
    }

    // Check if should retry on server error
    if (
      retryEnabled &&
      attempt < maxAttempts - 1 &&
      shouldRetry(null, response, retryServerErrors)
    ) {
      logger.warn('API request returned server error, will retry', {
        area: 'api',
        event: 'response_failed_retry',
        data: { url: normalizedPath, method, status: response.status, attempt },
      });
      continue;
    }

    const businessCase = isBusinessCase(response.status, codeFromBody, options.treatAsBusiness);
    if (businessCase) {
      const level = response.status === 401 ? 'info' : response.status === 403 ? 'warn' : 'info';
      logger[level]('API request returned business error', {
        area: 'api',
        event: 'response_business_error',
        data: {
          url: normalizedPath,
          method,
          status: response.status,
          duration_ms: durationMs,
          code: codeFromBody,
        },
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
        data: {
          url: normalizedPath,
          method,
          status: response.status,
          duration_ms: durationMs,
          attempts: attempt + 1,
        },
        error: message,
      });
      throw new ApiError(message, {
        status: response.status,
        kind: 'server',
        details,
        requestId: responseRequestId,
        code: codeFromBody,
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
      requestId: responseRequestId,
      code: codeFromBody,
    });
  }

  // Should not reach here, but handle edge case
  logger.error('API request exhausted all retries', {
    area: 'api',
    event: 'request_failed',
    data: { url: normalizedPath, method, attempts: maxAttempts },
    error: lastError,
  });
  throw new ApiError('Не удалось подключиться к API после нескольких попыток', {
    kind: lastResponse ? 'server' : 'network',
    cause: lastError,
    requestId,
  });
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const result = await requestResult<T>(path, options);
  if (!result.ok) {
    throw new ApiError(result.error.message ?? `Запрос завершился с ошибкой (${result.status})`, {
      status: result.status,
      kind: statusToKind(result.status),
      details: result.error.details,
      requestId: extractApiRequestId(result.error.details) ?? undefined,
      code: extractApiErrorCode(result.error.details) ?? result.error.code,
    });
  }
  return result.data;
}
