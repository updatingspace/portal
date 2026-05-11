export const APP_TITLE = 'UpdSpace Portal';

const normalizePart = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const formatTenantSegment = (tenantSlug?: string | null): string | null => {
  const normalizedTenantSlug = normalizePart(tenantSlug);
  return normalizedTenantSlug ? normalizedTenantSlug.toUpperCase() : null;
};

export const buildDocumentTitle = (params?: {
  pageTitle?: string | null;
  tenantSlug?: string | null;
}): string => {
  const pageTitle = normalizePart(params?.pageTitle);
  const tenantTitle = formatTenantSegment(params?.tenantSlug);

  const parts = [pageTitle, tenantTitle, APP_TITLE].filter((part, index, array): part is string => {
    if (!part) {
      return false;
    }

    return array.indexOf(part) === index;
  });

  return parts.join(' · ');
};
