import { getLegacyTenantAliasRedirectUrl, type BrowserLocationLike } from '../../shared/lib/tenant';

export const applyLegacyTenantAliasRedirect = (
  locationLike: BrowserLocationLike | null = typeof window !== 'undefined' ? window.location : null,
  redirect: ((url: string) => void) | null = typeof window !== 'undefined'
    ? window.location.replace.bind(window.location)
    : null,
): boolean => {
  if (!locationLike || !redirect) {
    return false;
  }

  const redirectUrl = getLegacyTenantAliasRedirectUrl(locationLike);
  if (!redirectUrl) {
    return false;
  }

  redirect(redirectUrl);
  return true;
};
