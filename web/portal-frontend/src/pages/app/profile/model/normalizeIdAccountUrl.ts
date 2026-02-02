const DEFAULT_ID_FRONTEND = 'https://id.updspace.com';

export const normalizeIdAccountUrl = (base?: string | null): string | null => {
  const raw = (base || '').trim();
  const resolved = raw || DEFAULT_ID_FRONTEND;

  try {
    const url = new URL(resolved);
    url.pathname = '/account';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
};
