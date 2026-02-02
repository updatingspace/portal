import React from 'react';
import { Card } from '@gravity-ui/uikit';

import { SkeletonBlock } from '../../../../shared/ui/skeleton/SkeletonBlock';
import { SkeletonText } from '../../../../shared/ui/skeleton/SkeletonText';

export const AccountDetailsSkeleton: React.FC = () => (
  <Card view="filled" className="p-4 mb-4" aria-busy="true">
    <SkeletonText width="35%" height={18} />
    <div className="d-flex flex-column gap-3 mt-3">
      <div className="d-flex justify-content-between">
        <SkeletonText width="22%" height={16} />
        <SkeletonBlock width="40%" height={16} radius={6} />
      </div>
      <div className="d-flex justify-content-between">
        <SkeletonText width="35%" height={16} />
        <SkeletonBlock width="55%" height={16} radius={6} />
      </div>
    </div>
  </Card>
);
