import { Card, Loader, Text } from '@gravity-ui/uikit';
import { memo } from 'react';

import { useAnalyticsReport } from '../../hooks/useAnalytics';

import './DashboardAnalytics.css';

function DashboardAnalyticsComponent() {
  const { report, isLoading, error, isForbidden } = useAnalyticsReport(30);

  if (isLoading) {
    return (
      <Card className="dashboard-analytics">
        <Loader size="m" />
      </Card>
    );
  }

  if (isForbidden) {
    return (
      <Card className="dashboard-analytics">
        <Text variant="header-2">Content Analytics (30 days)</Text>
        <Text variant="body-2" color="secondary">
          Analytics are unavailable for this account.
        </Text>
      </Card>
    );
  }

  if (error || !report) {
    return (
      <Card className="dashboard-analytics">
        <Text variant="body-2" color="danger">
          Failed to load analytics dashboard.
        </Text>
      </Card>
    );
  }

  return (
    <Card className="dashboard-analytics">
      <Text variant="header-2">Content Analytics (30 days)</Text>
      <div className="dashboard-analytics__grid">
        <div className="dashboard-analytics__metric">
          <Text variant="subheader-2">{report.total_views}</Text>
          <Text variant="caption-2" color="secondary">Views</Text>
        </div>
        <div className="dashboard-analytics__metric">
          <Text variant="subheader-2">{report.total_clicks}</Text>
          <Text variant="caption-2" color="secondary">Clicks</Text>
        </div>
        <div className="dashboard-analytics__metric">
          <Text variant="subheader-2">{report.total_dismissals}</Text>
          <Text variant="caption-2" color="secondary">Dismissals</Text>
        </div>
        <div className="dashboard-analytics__metric">
          <Text variant="subheader-2">{report.average_ctr}%</Text>
          <Text variant="caption-2" color="secondary">Average CTR</Text>
        </div>
      </div>
    </Card>
  );
}

export const DashboardAnalytics = memo(DashboardAnalyticsComponent);
