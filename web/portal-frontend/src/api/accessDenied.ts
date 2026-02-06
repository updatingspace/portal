export type AccessDeniedSource = 'api' | 'client';

export type AccessDeniedTenant = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  adminContact?: string | null;
};

type AccessDeniedOptions = {
  reason?: string;
  tenant?: AccessDeniedTenant | null;
  requestId?: string | null;
  requiredPermission?: string | null;
  service?: string | null;
  source: AccessDeniedSource;
  details?: unknown;
  path?: string | null;
};

type ApiLikeForbiddenError = {
  kind?: unknown;
  status?: unknown;
  message?: unknown;
  details?: unknown;
  requestId?: unknown;
  request_id?: unknown;
  code?: unknown;
};

const FORBIDDEN_DEFAULT_MESSAGE = 'Ой... мы и сами в шоке, но у вашего аккаунта нет прав на этот раздел.';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const extractRequestIdFromDetails = (details: unknown): string | null => {
  if (!details || typeof details !== 'object') return null;
  const source = details as { request_id?: unknown; error?: { request_id?: unknown } };
  if (isNonEmptyString(source.error?.request_id)) return source.error.request_id.trim();
  if (isNonEmptyString(source.request_id)) return source.request_id.trim();
  return null;
};

const sanitizeServiceName = (value: unknown): string | null => {
  if (!isNonEmptyString(value)) return null;
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,40}$/.test(normalized)) return null;
  return normalized;
};

const extractServiceFromDetails = (details: unknown): string | null => {
  if (!details || typeof details !== 'object') return null;
  const source = details as {
    service?: unknown;
    upstream?: unknown;
    error?: { service?: unknown; upstream?: unknown };
  };
  return (
    sanitizeServiceName(source.error?.service) ||
    sanitizeServiceName(source.error?.upstream) ||
    sanitizeServiceName(source.service) ||
    sanitizeServiceName(source.upstream)
  );
};

const resolvePath = (value: string | null | undefined): string | null => {
  if (isNonEmptyString(value)) return value.trim();
  if (typeof window === 'undefined') return null;
  return `${window.location.pathname}${window.location.search}`;
};

export class AccessDeniedError extends Error {
  public readonly status = 403;
  public readonly source: AccessDeniedSource;
  public readonly reason: string;
  public readonly tenant: AccessDeniedTenant | null;
  public readonly requestId: string | null;
  public readonly requiredPermission: string | null;
  public readonly service: string | null;
  public readonly details?: unknown;
  public readonly path: string | null;

  constructor(options: AccessDeniedOptions) {
    const reason = options.reason?.trim() || FORBIDDEN_DEFAULT_MESSAGE;
    super(reason);
    this.name = 'AccessDeniedError';
    this.reason = reason;
    this.source = options.source;
    this.tenant = options.tenant ?? null;
    this.requestId = options.requestId?.trim() || null;
    this.requiredPermission = options.requiredPermission?.trim() || null;
    this.service = sanitizeServiceName(options.service) ?? null;
    this.details = options.details;
    this.path = resolvePath(options.path);
  }
}

export const isAccessDeniedError = (error: unknown): error is AccessDeniedError =>
  error instanceof AccessDeniedError;

export const createClientAccessDeniedError = (options: {
  requiredPermission?: string;
  tenant?: AccessDeniedTenant | null;
  reason?: string;
  service?: string | null;
} = {}): AccessDeniedError =>
  new AccessDeniedError({
    source: 'client',
    requiredPermission: options.requiredPermission,
    tenant: options.tenant,
    reason: options.reason,
    service: options.service,
  });

export const toAccessDeniedError = (
  error: unknown,
  fallback: Partial<Omit<AccessDeniedOptions, 'source'>> & { source?: AccessDeniedSource } = {},
): AccessDeniedError | null => {
  if (isAccessDeniedError(error)) {
    return error;
  }

  if (!error || typeof error !== 'object') return null;

  const source = error as ApiLikeForbiddenError;
  const code = isNonEmptyString(source.code) ? source.code.trim().toUpperCase() : null;
  const kind = isNonEmptyString(source.kind) ? source.kind.trim().toLowerCase() : null;
  const status = typeof source.status === 'number' ? source.status : null;

  const isForbidden = kind === 'forbidden' || status === 403 || code === 'FORBIDDEN';
  if (!isForbidden) return null;

  const requestId =
    (isNonEmptyString(source.requestId) ? source.requestId.trim() : null) ||
    (isNonEmptyString(source.request_id) ? source.request_id.trim() : null) ||
    extractRequestIdFromDetails(source.details) ||
    fallback.requestId ||
    null;

  return new AccessDeniedError({
    source: fallback.source ?? 'api',
    reason: (isNonEmptyString(source.message) ? source.message : null) ?? fallback.reason,
    tenant: fallback.tenant ?? null,
    requestId,
    requiredPermission: fallback.requiredPermission ?? null,
    service: extractServiceFromDetails(source.details) ?? sanitizeServiceName(fallback.service) ?? null,
    details: source.details ?? fallback.details,
    path: fallback.path,
  });
};

export const ACCESS_DENIED_EVENT = 'updspace:access-denied';

export const emitAccessDenied = (error: AccessDeniedError): void => {
  if (typeof window === 'undefined') return;
  const detail = error.path
    ? error
    : new AccessDeniedError({
        source: error.source,
        reason: error.reason,
        tenant: error.tenant,
        requestId: error.requestId,
        requiredPermission: error.requiredPermission,
        service: error.service,
        details: error.details,
      });

  window.dispatchEvent(new CustomEvent<AccessDeniedError>(ACCESS_DENIED_EVENT, { detail }));
};

export const subscribeAccessDenied = (listener: (error: AccessDeniedError) => void): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<AccessDeniedError>).detail;
    if (!detail) return;
    listener(detail);
  };

  window.addEventListener(ACCESS_DENIED_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(ACCESS_DENIED_EVENT, handler as EventListener);
  };
};
