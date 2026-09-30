import React from 'react';
import { Button, Loader, Text } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';

import { useRouteBase } from '../../../../shared/hooks/useRouteBase';
import type { ActivityEvent } from '../../../../types/activity';
import { PostCard } from './PostCard';
import { PostCardSkeleton } from './PostCardSkeleton';
import {
  useUITranslation,
  InlineError,
} from '../../../../shared/ui/portal/PortalUI';
import { profileHubStrings } from '../strings/ru';

type ProfileFeedProps = {
  items: ActivityEvent[];
  isLoading: boolean;
  isError: boolean;
  isSelf: boolean;
  canViewPosts: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
  onCreatePost?: () => void;
};

export const ProfileFeed: React.FC<ProfileFeedProps> = ({
  items,
  isLoading,
  isError,
  isSelf,
  canViewPosts,
  hasNextPage,
  isFetchingNextPage,
  onRetry,
  onLoadMore,
  onCreatePost,
}) => {
  const t = useUITranslation();
  const navigate = useNavigate();
  const routeBase = useRouteBase();

  if (!canViewPosts) {
    return (
      <div className="profile-hub__feed-state">
        <Text variant="subheader-2">{profileHubStrings.feedNoPermission}</Text>
        <Button view="outlined" size="m" onClick={() => navigate(routeBase)}>
          {profileHubStrings.common.toHome}
        </Button>
      </div>
    );
  }

  if (isLoading && items.length === 0) {
    return (
      <div className="profile-hub__feed-list">
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }

  if (isError && items.length === 0) {
    return (
      <div className="profile-hub__feed-state">
        <Text variant="subheader-2">{profileHubStrings.feedErrorTitle}</Text>
        <Text variant="body-2" color="secondary">
          {profileHubStrings.feedErrorHint}
        </Text>
        <Button view="outlined" size="m" onClick={onRetry}>
          {profileHubStrings.retry}
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="profile-hub__feed-state">
        <Text variant="subheader-2">
          {t('Публикаций пока нет', 'No posts yet')}
        </Text>
        <Text variant="body-2" color="secondary">
          {t(
            'Здесь появятся ваши публикации в сообществе.',
            'Your community posts will appear here.',
          )}
        </Text>
        {isSelf && onCreatePost && (
          <Button view="action" size="xl" onClick={onCreatePost}>
            {t('Написать публикацию', 'Write a post')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="profile-hub__feed-list">
      {isError && (
        <InlineError onRetry={onRetry}>
          {t('Не удалось обновить публикации.', 'Could not refresh posts.')}
        </InlineError>
      )}
      {items.map((item) => (
        <PostCard key={`${item.id}`} item={item} />
      ))}
      {hasNextPage && (
        <Button
          view="flat"
          size="m"
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? (
            <Loader size="s" />
          ) : (
            profileHubStrings.loadMore
          )}
        </Button>
      )}
    </div>
  );
};
