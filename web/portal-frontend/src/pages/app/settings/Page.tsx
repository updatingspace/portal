import React, { useCallback } from 'react';

import { useAuth } from '../../../contexts/AuthContext';
import { useSettingsData } from './model/useSettingsData';
import { LinksSection } from './ui/LinksSection';
import { ProfileSection } from './ui/ProfileSection';
import { SecuritySection } from './ui/SecuritySection';
import { SecuritySectionSkeleton } from './ui/SecuritySectionSkeleton';
import { SessionsSection } from './ui/SessionsSection';
import { SessionsSectionSkeleton } from './ui/SessionsSectionSkeleton';

const ID_PORTAL_BASE_URL = 'http://id.localhost:8000';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const {
    sessions,
    mfaStatus,
    loadingSessions,
    loadingMfa,
    sessionsError,
    mfaError,
    revokingId,
    refreshSessions,
    refreshMfa,
    revokeActiveSession,
  } = useSettingsData();

  const handleSecurityRetry = useCallback(() => {
    refreshMfa();
  }, [refreshMfa]);

  const handleSessionsRetry = useCallback(() => {
    refreshSessions();
  }, [refreshSessions]);

  if (!user) {
    return null;
  }

  return (
    <div className="container-fluid" style={{ maxWidth: 800 }}>
      <div className="text-muted small">Account</div>
      <h1 className="h3 fw-semibold mb-4">Settings</h1>

      <ProfileSection user={user} idPortalUrl={ID_PORTAL_BASE_URL} />

      {loadingMfa ? (
        <SecuritySectionSkeleton />
      ) : (
        <SecuritySection
          idPortalUrl={ID_PORTAL_BASE_URL}
          mfaStatus={mfaStatus}
          isLoading={loadingMfa}
          error={mfaError}
          onRetry={handleSecurityRetry}
        />
      )}

      {loadingSessions ? (
        <SessionsSectionSkeleton />
      ) : (
        <SessionsSection
          sessions={sessions}
          isLoading={loadingSessions}
          error={sessionsError}
          revokingId={revokingId}
          onRevoke={revokeActiveSession}
          onRetry={handleSessionsRetry}
        />
      )}

      <LinksSection idPortalUrl={ID_PORTAL_BASE_URL} />
    </div>
  );
};
