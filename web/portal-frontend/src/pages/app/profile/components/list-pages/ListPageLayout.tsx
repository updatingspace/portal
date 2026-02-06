import React from 'react';
import { Button, Card, Text } from '@gravity-ui/uikit';
import '../../profile-hub.css';
import { profileHubStrings } from '../../strings/ru';

type ListPageLayoutProps = {
  title: string;
  isLoading?: boolean;
  isError?: boolean;
  emptyText: string;
  items: { id: string; title: string; subtitle?: string }[];
  onRetry?: () => void;
};

export const ListPageLayout: React.FC<ListPageLayoutProps> = ({
  title,
  isLoading,
  isError,
  emptyText,
  items,
  onRetry,
}) => {
  return (
    <div className="profile-list-page">
      <h1 className="profile-list-page__title">{title}</h1>
      <Card view="filled" className="profile-list-page__search-slot">
        <Text variant="body-2" color="secondary">{profileHubStrings.listPage.searchBacklogHint}</Text>
      </Card>

      {isLoading ? (
        <Card view="filled"><Text variant="body-2" color="secondary">{profileHubStrings.listPage.loading}</Text></Card>
      ) : isError ? (
        <Card view="filled" className="profile-list-page__state">
          <Text variant="subheader-2">{profileHubStrings.listPage.errorTitle}</Text>
          {onRetry && <Button view="outlined" size="m" onClick={onRetry}>Повторить</Button>}
        </Card>
      ) : items.length === 0 ? (
        <Card view="filled" className="profile-list-page__state">
          <Text variant="body-2" color="secondary">{emptyText}</Text>
        </Card>
      ) : (
        <div className="profile-list-page__items">
          {items.map((item) => (
            <Card key={item.id} view="filled" className="profile-list-page__item">
              <Text variant="body-1">{item.title}</Text>
              {item.subtitle && <Text variant="body-2" color="secondary">{item.subtitle}</Text>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
