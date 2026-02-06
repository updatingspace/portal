import React from 'react';
import { Button, Card, Text } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';

import type { ProfileWidgetPreviewItemVM } from '../../model/types';
import { profileHubStrings } from '../../strings/ru';

type FollowingWidgetProps = {
  items: ProfileWidgetPreviewItemVM[];
};

export const FollowingWidget: React.FC<FollowingWidgetProps> = ({ items }) => {
  const navigate = useNavigate();

  return (
    <Card view="filled" className="profile-widget">
      <div className="profile-widget__head">
        <Text variant="subheader-2">{profileHubStrings.following.title}</Text>
        <Text variant="caption-2" color="secondary">{items.length}</Text>
      </div>
      {items.length === 0 ? (
        <Text variant="body-2" color="secondary">{profileHubStrings.following.empty}</Text>
      ) : (
        <div className="profile-widget__list">
          {items.slice(0, 5).map((item) => (
            <Text key={item.id} variant="body-2">{item.title}</Text>
          ))}
        </div>
      )}
      <Button view="flat" size="s" onClick={() => navigate('/app/profile/following')}>
        {profileHubStrings.following.showAll}
      </Button>
    </Card>
  );
};
