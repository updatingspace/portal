import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { StatusView } from '../../modules/portal/components/StatusView';

export const RequireSession: React.FC = () => {
  const { user, isInitialized, isLoading, sessionIssue } = useAuth();
  const location = useLocation();

  if (!isInitialized || (isLoading && !user)) {
    return null;
  }

  if (!user) {
    if (sessionIssue?.code === 'NO_ACTIVE_MEMBERSHIP') {
      return (
        <StatusView
          kind="no-access"
          title="Нет активного доступа к tenant"
          description={sessionIssue.message}
        />
      );
    }
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
};
