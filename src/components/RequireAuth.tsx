import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAuthUI } from '../contexts/AuthUIContext';

type Props = {
  children: React.ReactElement;
  superuserOnly?: boolean;
};

export const RequireAuth: React.FC<Props> = ({ children, superuserOnly = false }) => {
  const { user, isInitialized } = useAuth();
  const { openAuthModal } = useAuthUI();

  const allowed =
    !!user && (!superuserOnly || Boolean(user.isSuperuser));

  useEffect(() => {
    if (isInitialized && !allowed) {
      openAuthModal('login');
    }
  }, [allowed, isInitialized, openAuthModal]);

  if (!isInitialized) return null;
  if (!allowed) return <Navigate to="/" replace />;
  return children;
};

