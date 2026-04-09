import React from 'react';

import { AppLoader } from '../../shared/ui/AppLoader';
import { useAuth } from '../../contexts/AuthContext';

export const AuthLoadingGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isInitialized } = useAuth();

  // Guard only the first auth bootstrap.
  // Background refreshes must not unmount the router tree.
  if (!isInitialized) {
    return <AppLoader />;
  }

  return <>{children}</>;
};
