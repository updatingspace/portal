import { useParams } from 'react-router-dom';

/**
 * Returns the route base for in-app navigation.
 *
 * When inside `/t/:tenantSlug/*` routes → `/t/<slug>`
 * Fallback for legacy `/app/*` routes   → `/app`
 *
 * Usage:
 *   const routeBase = useRouteBase();
 *   navigate(`${routeBase}/feed`);
 *   <Link to={`${routeBase}/voting/${id}`}>…</Link>
 */
export function useRouteBase(): string {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  return tenantSlug ? `/t/${tenantSlug}` : '/app';
}
