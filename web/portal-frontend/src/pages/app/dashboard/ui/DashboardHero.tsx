import React from 'react';
import { Button, Card, Text } from '@gravity-ui/uikit';

type DashboardHeroProps = {
  onOpenFeed: () => void;
  onOpenEvents: () => void;
  onOpenVoting: () => void;
};

export const DashboardHero: React.FC<DashboardHeroProps> = ({
  onOpenFeed,
  onOpenEvents,
  onOpenVoting,
}) => (
  <Card view="filled" className="mb-4 p-4">
    <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3">
      <div>
        <Text variant="kicker" className="text-uppercase mb-2 text-muted">
          Welcome back
        </Text>
        <Text variant="header-1" className="mb-2">
          AEF Portal overview
        </Text>
        <Text variant="body-1" color="secondary">
          Monitor polls, events, and community activity from one place.
        </Text>
      </div>
      <div className="d-flex flex-wrap gap-2">
        <Button view="action" onClick={onOpenVoting}>
          Open voting
        </Button>
        <Button view="outlined-info" onClick={onOpenEvents}>
          View events
        </Button>
        <Button view="outlined" onClick={onOpenFeed}>
          Open feed
        </Button>
      </div>
    </div>
  </Card>
);
