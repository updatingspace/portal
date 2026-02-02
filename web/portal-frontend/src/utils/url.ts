type LocationLike = Pick<Location, 'protocol' | 'hostname' | 'origin'>;

/**
 * Upgrades http:// URLs that point to the current host to https:// when the page itself is served
 * over HTTPS. Prevents mixed-content warnings for assets like avatars that may come back with
 * an http scheme.
 */
export function enforceHttpsForSameHost(
  url?: string | null,
  currentLocation: LocationLike | null = typeof window !== 'undefined' ? window.location : null,
): string | null | undefined {
  if (url === null || url === undefined) return url;
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (!currentLocation || currentLocation.protocol !== 'https:') return trimmed;

  try {
    const parsed = new URL(trimmed, currentLocation.origin);
    if (parsed.protocol === 'http:' && parsed.hostname === currentLocation.hostname) {
      parsed.protocol = 'https:';
      return parsed.toString();
    }
  } catch {
    /* ignore malformed URLs and fall back to the original value */
  }

  return trimmed;
}
