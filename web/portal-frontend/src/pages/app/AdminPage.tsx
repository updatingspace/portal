import { Navigate } from 'react-router-dom';
import { useRouteBase } from '../../shared/hooks/useRouteBase';
export function AdminPage() {
  const base = useRouteBase();
  return <Navigate to={`${base}/tenant-admin?tab=applications`} replace />;
}
