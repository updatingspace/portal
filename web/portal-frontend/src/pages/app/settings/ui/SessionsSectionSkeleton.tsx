import React from 'react';
import { Card, Text } from '@gravity-ui/uikit';

import { SkeletonBlock } from '../../../../shared/ui/skeleton/SkeletonBlock';
import { SkeletonList } from '../../../../shared/ui/skeleton/SkeletonList';
import { SkeletonText } from '../../../../shared/ui/skeleton/SkeletonText';

export const SessionsSectionSkeleton: React.FC = () => (
  <Card view="filled" className="p-4 mb-4" aria-busy="true">
    <div className="d-flex align-items-center gap-2 mb-3">
      <SkeletonText width="35%" height={18} />
    </div>
    <Text variant="body-1" color="secondary" className="mb-3">
      <SkeletonText width="60%" height={14} />
    </Text>
    <SkeletonList rows={3} />
    <div style={{ marginTop: 16 }}>
      <SkeletonBlock width={90} height={24} radius={12} />
    </div>
  </Card>
);
