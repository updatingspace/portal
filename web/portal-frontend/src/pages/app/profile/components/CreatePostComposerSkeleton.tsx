import React from 'react';
import { Card } from '@gravity-ui/uikit';

import { SkeletonBlock } from '../../../../shared/ui/skeleton/SkeletonBlock';

export const CreatePostComposerSkeleton: React.FC = () => (
  <Card view="filled" className="profile-hub__composer" aria-busy="true">
    <SkeletonBlock width="100%" height={80} radius={12} />
    <div className="profile-hub__composer-footer">
      <SkeletonBlock width="140px" height={36} radius={18} />
    </div>
  </Card>
);
