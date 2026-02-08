import React from 'react';
import { Button, Card, Text } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';

import { useRouteBase } from '../../../../../shared/hooks/useRouteBase';
import { profileHubStrings } from '../../strings/ru';

type AboutWidgetProps = {
  language?: string;
  timezone?: string;
  contacts?: string[];
  isSelf: boolean;
};

export const AboutWidget: React.FC<AboutWidgetProps> = ({ language, timezone, contacts, isSelf }) => {
  const navigate = useNavigate();
  const routeBase = useRouteBase();
  const hasData = Boolean(language || timezone || (contacts && contacts.length > 0));

  return (
    <Card view="filled" className="profile-widget">
      <div className="profile-widget__head">
        <Text variant="subheader-2">{profileHubStrings.about.title}</Text>
        {isSelf && (
          <Button view="flat" size="s" onClick={() => navigate(`${routeBase}/settings`)}>
            {profileHubStrings.about.edit}
          </Button>
        )}
      </div>
      {!hasData ? (
        <Text variant="body-2" color="secondary">{profileHubStrings.about.empty}</Text>
      ) : (
        <div className="profile-widget__list">
          {language && <Text variant="body-2">{profileHubStrings.about.language}: {language}</Text>}
          {timezone && <Text variant="body-2">{profileHubStrings.about.timezone}: {timezone}</Text>}
          {contacts?.map((contact) => (
            <Text key={contact} variant="body-2">{contact}</Text>
          ))}
        </div>
      )}
    </Card>
  );
};
