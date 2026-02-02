import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { StatusView } from '../modules/portal/components/StatusView';

type Props = {
  children: React.ReactElement;
  superuserOnly?: boolean;
};

export const RequireAuth: React.FC<Props> = ({ children, superuserOnly = false }) => {
  const { user, isInitialized, isLoading } = useAuth();

  const allowed =
    !!user && (!superuserOnly || Boolean(user.isSuperuser));

  useEffect(() => {
    // keep hook for future side-effects; no modal auth in portal UX
  }, []);

  if (!isInitialized || isLoading) {
    return <StatusView kind="loading" />;
  }

  if (!user) {
    return <StatusView kind="unauthorized" showLogin />;
  }

  if (!allowed) {
    return <StatusView kind="no-access" />;
  }
  return children;
};

