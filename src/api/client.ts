export type ApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'server'
  | 'unknown';

const DEFAULT_API_BASE_URL = 'http://localhost:8000/api';

const baseUrl = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
)?.replace(/\/$/, '') ?? DEFAULT_API_BASE_URL;

const withLeadingSlash = (path: string) =>
  path.startsWith('/') ? path : `/${path}`;

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
  const url = `${baseUrl}${withLeadingSlash(path)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    throw new ApiError('Не удалось подключиться к API', {
      kind: 'network',
      cause: error,
    });
  }

  if (!response.ok) {
    const messageFromBody = await parseErrorMessage(response);
    const message = messageFromBody ?? `Запрос завершился с ошибкой (${response.status})`;

    throw new ApiError(message, {
      status: response.status,
      kind: statusToKind(response.status),
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
