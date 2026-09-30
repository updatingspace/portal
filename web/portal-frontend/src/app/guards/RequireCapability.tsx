import {Button} from '@gravity-ui/uikit';
import {PageState,useUITranslation} from '../../shared/ui/portal/PortalUI';
import React from 'react';
import { Outlet } from 'react-router-dom';

import { createClientAccessDeniedError } from '../../api/accessDenied';
import { useAuth } from '../../contexts/AuthContext';
import { AccessDeniedScreen } from '../../features/access-denied';
import { AppLoader } from '../../shared/ui/AppLoader';
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
  const { user, isLoading, isInitialized, refreshProfile } = useAuth();

  const t = useUITranslation();
  if (!isInitialized || isLoading || !user) {
    return <AppLoader />;
  }

  const requiredList = Array.isArray(required) ? required : [required];
  const allowed =
    mode === 'any'
      ? requiredList.some((permission) => can(user, permission))
      : can(user, requiredList);

  if (!allowed && user.accessSnapshotStatus && user.accessSnapshotStatus !== 'ready') return <PageState kind="error" title={t('Не удалось проверить права', 'Unable to verify permissions')} description={t('Ваши разрешения загружены не полностью. Повторите проверку.', 'Your permissions could not be fully loaded. Try again.')} action={<Button onClick={() => void refreshProfile()}>{t('Повторить', 'Try again')}</Button>} />;
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
