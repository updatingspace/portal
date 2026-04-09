import React from 'react';

import { useAuth } from '../../../contexts/AuthContext';
import { usePortalI18n } from '../../../shared/i18n/usePortalI18n';
import { PersonalizationSection } from './ui/PersonalizationSection';
import { ProfileSection } from './ui/ProfileSection';

const ID_PORTAL_BASE_URL = 'http://id.localhost:8000';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = usePortalI18n();

  if (!user) {
    return null;
  }

  return (
    <div className="container-fluid" style={{ maxWidth: 800 }}>
      <div className="text-muted small">{t('settings.kicker')}</div>
      <h1 className="h3 fw-semibold mb-4">{t('settings.title')}</h1>

      <ProfileSection user={user} idPortalUrl={ID_PORTAL_BASE_URL} />

      <PersonalizationSection />
    </div>
  );
};
