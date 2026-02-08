import React from 'react';

import { VotingForbiddenState } from '../states/VotingViewStates';

export interface VotingPermissionGuardProps {
  allowed: boolean;
  fallbackMessage?: string;
  children: React.ReactNode;
}

export const VotingPermissionGuard: React.FC<VotingPermissionGuardProps> = ({
  allowed,
  fallbackMessage,
  children,
}) => {
  if (!allowed) {
    return <VotingForbiddenState message={fallbackMessage} />;
  }

  return <>{children}</>;
};
