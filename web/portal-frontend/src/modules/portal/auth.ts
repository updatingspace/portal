const rawLoginPath = (import.meta.env.VITE_LOGIN_PATH as string | undefined) ?? '__VITE_LOGIN_PATH__';
const rawIdLoginUrl = (import.meta.env.VITE_ID_LOGIN_URL as string | undefined) ?? '__VITE_ID_LOGIN_URL__';

const DEFAULT_LOGIN_PATH = '/api/v1/auth/login';

const normalize = (value: string | undefined) => (value ? value.trim().replace(/\s+/g, '') : '');

export const LOGIN_PATH = (() => {
  const v = normalize(rawLoginPath);
  if (!v || v === '__VITE_LOGIN_PATH__') return DEFAULT_LOGIN_PATH;
  return v;
})();

// Legacy fallback: direct IdP URL (discouraged; prefer LOGIN_PATH via BFF)
export const ID_LOGIN_URL = (() => {
  const v = normalize(rawIdLoginUrl);
  if (!v || v === '__VITE_ID_LOGIN_URL__') return 'https://id.updspace.com';
  return v;
})();

const buildLoginUrl = (nextPath: string | null) => {
  if (LOGIN_PATH.startsWith('http://') || LOGIN_PATH.startsWith('https://')) {
    const u = new URL(LOGIN_PATH);
    if (nextPath) u.searchParams.set('next', nextPath);
    return u.toString();
  }

  // Relative or absolute path on same origin
  const u = new URL(LOGIN_PATH.startsWith('/') ? LOGIN_PATH : `/${LOGIN_PATH}`, window.location.origin);
  if (nextPath) u.searchParams.set('next', nextPath);
  return u.toString();
};

export function redirectToLogin(nextPath?: string): void {
  if (typeof window === 'undefined') return;

  const resolvedNext = nextPath ?? `${window.location.pathname}${window.location.search}`;

  // Prefer same-origin login initiation via BFF
  try {
    window.location.assign(buildLoginUrl(resolvedNext));
    return;
  } catch {
    /* ignore */
  }

  // Fallback (shouldn't be used in local dev)
  window.location.assign(ID_LOGIN_URL);
}
