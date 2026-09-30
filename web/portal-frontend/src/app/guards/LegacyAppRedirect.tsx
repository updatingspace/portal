import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
export function LegacyAppRedirect() {
  const {user} = useAuth();
  const location = useLocation();
  const target = user?.tenant?.slug ? `/t/${user.tenant.slug}${location.pathname.slice(4)}${location.search}${location.hash}` : '/choose-tenant';
  return <Navigate to={target} replace />;
}
