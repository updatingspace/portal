import React from 'react';

import { profileHubStrings } from '../../strings/ru';
import { ListPageLayout } from './ListPageLayout';

export const FollowingListPage: React.FC = () => {
  return (
    <ListPageLayout
      title={profileHubStrings.following.title}
      emptyText={profileHubStrings.following.empty}
      items={[]}
    />
  );
};
