import React from 'react';
import { Card, Text } from '@gravity-ui/uikit';

import type { DashboardStat } from '../model/useDashboardStats';

export const DashboardCard: React.FC<{ stat: DashboardStat }> = ({ stat }) => (
  <Card view="filled" className="dashboard-card p-3 h-100">
    <Text variant="subheader-2" as="div" className="dashboard-card__title">
      {stat.title}
    </Text>
    <Text variant="header-1" as="div" className="dashboard-card__value fw-bold">
      {stat.value}
    </Text>
    <Text variant="body-2" as="div" color="secondary" className="dashboard-card__description">
      {stat.description}
    </Text>
  </Card>
);
