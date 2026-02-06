import React from 'react';
import { Card } from '@gravity-ui/uikit';

import { SkeletonBlock } from '../../../../../shared/ui/skeleton/SkeletonBlock';

export const WidgetSkeleton: React.FC = () => (
  <Card view="filled" className="profile-widget" aria-busy="true">
    <SkeletonBlock width="50%" height={16} radius={8} />
    <SkeletonBlock width="100%" height={12} radius={8} />
    <SkeletonBlock width="75%" height={12} radius={8} />
  </Card>
);
