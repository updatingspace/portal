import React from 'react';
import { Card, Text } from '@gravity-ui/uikit';

import type { DashboardStat } from '../model/useDashboardStats';

export const DashboardCard: React.FC<{ stat: DashboardStat }> = ({ stat }) => (
  <Card view="filled" className="p-3 h-100">
    <Text variant="subheader-2" className="mb-2">
      {stat.title}
    </Text>
    <Text variant="header-1" className="mb-2 fw-bold">
      {stat.value}
    </Text>
    <Text variant="body-2" color="secondary">
      {stat.description}
    </Text>
  </Card>
);
