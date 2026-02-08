import React from 'react';
import { Button, Card, Text } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';

import { useRouteBase } from '../../../../../shared/hooks/useRouteBase';
import type { ProfileWidgetPreviewItemVM } from '../../model/types';
import { profileHubStrings } from '../../strings/ru';

type CommunitiesWidgetProps = {
  items: ProfileWidgetPreviewItemVM[];
};

export const CommunitiesWidget: React.FC<CommunitiesWidgetProps> = ({ items }) => {
  const navigate = useNavigate();
  const routeBase = useRouteBase();

  return (
    <Card view="filled" className="profile-widget">
      <div className="profile-widget__head">
        <Text variant="subheader-2">{profileHubStrings.communities.title}</Text>
        <Text variant="caption-2" color="secondary">{items.length}</Text>
      </div>
      {items.length === 0 ? (
        <Text variant="body-2" color="secondary">{profileHubStrings.communities.empty}</Text>
      ) : (
        <div className="profile-widget__list">
          {items.slice(0, 5).map((item) => (
            <Text key={item.id} variant="body-2">{item.title}</Text>
          ))}
        </div>
      )}
      <Button view="flat" size="s" onClick={() => navigate(`${routeBase}/profile/communities`)}>
        {profileHubStrings.communities.showAll}
      </Button>
    </Card>
  );
};
