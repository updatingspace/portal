import { Button } from '@gravity-ui/uikit';
import { PageState } from '../../shared/ui/portal/PortalUI';
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { AppLoader } from '../../shared/ui/AppLoader';
import { StatusView } from '../../modules/portal/components/StatusView';

export const RequireSession: React.FC = () => {
  const { user, isInitialized, isLoading, sessionIssue, refreshProfile } = useAuth();
  const location = useLocation();

  if (!isInitialized || (isLoading && !user)) {
    return <AppLoader />;
  }

  if (!user) {
    if (sessionIssue?.code === 'SESSION_UNAVAILABLE') return <PageState kind="error" title="Не удалось проверить вход" description={sessionIssue.message} action={<Button onClick={() => void refreshProfile()}>Повторить</Button>} />;
    if (sessionIssue?.code === 'NO_ACTIVE_MEMBERSHIP') {
      return (
        <StatusView
          kind="no-access"
          title="Нет доступа к сообществу"
          description={sessionIssue.message}
        />
      );
    }
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
};
