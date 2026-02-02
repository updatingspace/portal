import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AppLoader } from './AppLoader';

type Props = {
  children: React.ReactNode;
};

export const AuthLoadingGuard: React.FC<Props> = ({ children }) => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <AppLoader />;
  }

  return <>{children}</>;
};
