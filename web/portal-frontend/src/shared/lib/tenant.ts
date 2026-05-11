export type TenantInfo = {
  slug: string;
  host: string;
};

export type BrowserLocationLike = Pick<Location, 'protocol' | 'host' | 'pathname' | 'search' | 'hash'>;

const LOCALHOST_SUFFIX = '.localhost';
const RESERVED_HOST_SLUGS = new Set(['portal', 'www', 'admin', 'app']);
const API_HOST_PREFIX = 'api';

const isLocalhostLike = (host: string) =>
  host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local');

const withPort = (hostname: string, port: string) => (port ? `${hostname}:${port}` : hostname);

const splitHostPort = (host: string): { hostname: string; port: string } => {
  const normalized = host.trim().toLowerCase();
  const colonIndex = normalized.lastIndexOf(':');
  if (colonIndex > -1) {
    const candidatePort = normalized.slice(colonIndex + 1);
    if (/^\d+$/.test(candidatePort)) {
      return {
        hostname: normalized.slice(0, colonIndex),
        port: candidatePort,
      };
    }
  }
  return { hostname: normalized, port: '' };
};

const extractTenantSlug = (labels: string[]): string | null => {
  if (labels.length === 0) return null;
  const offset = labels[0] === API_HOST_PREFIX && labels.length > 1 ? 1 : 0;
  const slug = labels[offset]?.trim().toLowerCase();
  if (!slug || RESERVED_HOST_SLUGS.has(slug)) {
    return null;
  }
  return slug;
};

const resolveExplicitTenantHost = (host: string): TenantInfo | null => {
  const { hostname, port } = splitHostPort(host);

  if (hostname.endsWith(LOCALHOST_SUFFIX)) {
    const labels = hostname
      .slice(0, -LOCALHOST_SUFFIX.length)
      .split('.')
      .filter(Boolean);
    const slug = extractTenantSlug(labels);
    if (!slug) return null;
    return { slug, host: withPort(hostname, port) };
  }

  const labels = hostname.split('.').filter(Boolean);
  if (labels.length < 3) {
    return null;
  }

  const slug = extractTenantSlug(labels);
  if (!slug) return null;
  return { slug, host: withPort(hostname, port) };
};

const sanitizeInternalPath = (path: string | null | undefined, defaultPath: string): string => {
  const candidate = String(path ?? '').trim();
  if (
    !candidate ||
    candidate.startsWith('http://') ||
    candidate.startsWith('https://') ||
    candidate.startsWith('//') ||
    !candidate.startsWith('/')
  ) {
    return defaultPath;
  }
  return candidate;
};

export const getTenantAliasFromHost = (host: string): TenantInfo | null =>
  resolveExplicitTenantHost(host);

export const getPortalHostForTenantAlias = (host: string): string | null => {
  const tenant = getTenantAliasFromHost(host);
  if (!tenant) return null;

  const { hostname, port } = splitHostPort(host);
  if (hostname.endsWith(LOCALHOST_SUFFIX)) {
    return withPort(`portal${LOCALHOST_SUFFIX}`, port);
  }

  const labels = hostname.split('.').filter(Boolean);
  const suffixStart = labels[0] === API_HOST_PREFIX && labels.length > 3 ? 2 : 1;
  if (labels.length <= suffixStart) {
    return null;
  }

  return withPort(['portal', ...labels.slice(suffixStart)].join('.'), port);
};

export const getTenantAppRootPath = (tenantSlug: string): string => `/t/${tenantSlug}/`;

export const toCanonicalTenantPath = (
  path: string | null | undefined,
  tenantSlug: string,
): string => {
  const tenantRootPath = getTenantAppRootPath(tenantSlug);
  const candidate = sanitizeInternalPath(path, tenantRootPath);
  const url = new URL(candidate, 'http://tenant.local');
  const { pathname, search, hash } = url;

  if (pathname === '/app' || pathname === '/app/') {
    return `${tenantRootPath}${search}${hash}`;
  }

  if (pathname.startsWith('/app/')) {
    return `/t/${tenantSlug}${pathname.slice('/app'.length)}${search}${hash}`;
  }

  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/choose-tenant' ||
    pathname === `/t/${tenantSlug}` ||
    pathname === `/t/${tenantSlug}/`
  ) {
    return `${tenantRootPath}${search}${hash}`;
  }

  if (pathname.startsWith('/t/')) {
    return `${pathname}${search}${hash}`;
  }

  return tenantRootPath;
};

export const getLegacyTenantAliasRedirectUrl = (
  location: BrowserLocationLike,
): string | null => {
  const tenant = getTenantAliasFromHost(location.host);
  const portalHost = getPortalHostForTenantAlias(location.host);
  if (!tenant || !portalHost) {
    return null;
  }

  const pathname = location.pathname || '/';
  if (pathname === '/login') {
    const params = new URLSearchParams(location.search);
    const next = toCanonicalTenantPath(params.get('next'), tenant.slug);
    params.set('next', next);
    const redirectUrl = new URL('/login', `${location.protocol}//${portalHost}`);
    redirectUrl.search = params.toString();
    return redirectUrl.toString();
  }

  if (
    pathname === '/choose-tenant' ||
    pathname === '/app' ||
    pathname === '/app/' ||
    pathname.startsWith('/app/') ||
    pathname.startsWith('/t/')
  ) {
    const nextPath = toCanonicalTenantPath(
      `${pathname}${location.search || ''}${location.hash || ''}`,
      tenant.slug,
    );
    return new URL(nextPath, `${location.protocol}//${portalHost}`).toString();
  }

  return null;
};

export const getTenantFromHost = (host: string, fallbackSlug?: string | null): TenantInfo | null => {
  const explicitTenant = resolveExplicitTenantHost(host);
  if (explicitTenant) {
    return explicitTenant;
  }

  const { hostname, port } = splitHostPort(host);
  const normalizedFallback = fallbackSlug?.trim().toLowerCase();
  if (
    isLocalhostLike(hostname) &&
    normalizedFallback &&
    !RESERVED_HOST_SLUGS.has(normalizedFallback)
  ) {
    return { slug: normalizedFallback, host: withPort(hostname, port) };
  }

  return null;
};
