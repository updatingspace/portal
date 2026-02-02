import React from 'react';

import { AppLoader } from '../../shared/ui/AppLoader';
import { useAuth } from '../../contexts/AuthContext';

export const AuthLoadingGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isInitialized, isLoading } = useAuth();

  if (!isInitialized || isLoading) {
    return <AppLoader />;
  }

  return <>{children}</>;
};
