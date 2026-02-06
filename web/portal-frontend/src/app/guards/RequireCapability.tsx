import React from 'react';
import { Outlet } from 'react-router-dom';

import { createClientAccessDeniedError } from '../../api/accessDenied';
import { useAuth } from '../../contexts/AuthContext';
import { AccessDeniedScreen } from '../../features/access-denied';
import { can } from '../../features/rbac/can';

type RequireCapabilityProps = {
  required: string | string[];
  mode?: 'all' | 'any';
  children?: React.ReactNode;
};

export const RequireCapability: React.FC<RequireCapabilityProps> = ({
  required,
  mode = 'all',
  children,
}) => {
  const { user, isLoading, isInitialized } = useAuth();

  if (!isInitialized || isLoading || !user) {
    return null;
  }

  const requiredList = Array.isArray(required) ? required : [required];
  const allowed =
    mode === 'any'
      ? requiredList.some((permission) => can(user, permission))
      : can(user, requiredList);

  if (!allowed) {
    return (
      <AccessDeniedScreen
        error={createClientAccessDeniedError({
          requiredPermission: requiredList.join(', '),
          tenant: user.tenant,
        })}
      />
    );
  }

  if (children) {
    return <>{children}</>;
  }

  return <Outlet />;
};
