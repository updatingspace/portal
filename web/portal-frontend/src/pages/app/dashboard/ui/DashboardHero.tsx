import React from 'react';
import { Button, Card, Text } from '@gravity-ui/uikit';

import { usePortalI18n } from '../../../../shared/i18n/usePortalI18n';

type DashboardHeroProps = {
  onOpenFeed: () => void;
  onOpenEvents: () => void;
  onOpenVoting: () => void;
};

export const DashboardHero: React.FC<DashboardHeroProps> = ({
  onOpenFeed,
  onOpenEvents,
  onOpenVoting,
}) => {
  const { t } = usePortalI18n();

  return (
    <Card view="filled" className="mb-4 p-4">
      <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3">
        <div>
          <Text variant="caption-2" className="text-uppercase mb-2 text-muted">
            {t('dashboard.kicker')}
          </Text>
          <Text variant="header-1" className="mb-2">
            {t('dashboard.title')}
          </Text>
          <Text variant="body-1" color="secondary">
            {t('dashboard.subtitle')}
          </Text>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button view="action" onClick={onOpenVoting}>
            {t('dashboard.actions.openVoting')}
          </Button>
          <Button view="outlined-info" onClick={onOpenEvents}>
            {t('dashboard.actions.openEvents')}
          </Button>
          <Button view="outlined" onClick={onOpenFeed}>
            {t('dashboard.actions.openFeed')}
          </Button>
        </div>
      </div>
    </Card>
  );
};
