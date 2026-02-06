import React from 'react';
import { Button, Card, Loader, Text } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';

import type { ActivityEvent } from '../../../../types/activity';
import { PostCard } from './PostCard';
import { PostCardSkeleton } from './PostCardSkeleton';
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
  onCreatePost: () => void;
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
  const navigate = useNavigate();

  if (!canViewPosts) {
    return (
      <Card view="filled" className="profile-hub__feed-state">
        <Text variant="subheader-2">{profileHubStrings.feedNoPermission}</Text>
        <Button view="outlined" size="m" onClick={() => navigate('/app')}>
          {profileHubStrings.common.toHome}
        </Button>
      </Card>
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

  if (isError) {
    return (
      <Card view="filled" className="profile-hub__feed-state">
        <Text variant="subheader-2">{profileHubStrings.feedErrorTitle}</Text>
        <Text variant="body-2" color="secondary">{profileHubStrings.feedErrorHint}</Text>
        <Button view="outlined" size="m" onClick={onRetry}>{profileHubStrings.retry}</Button>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card view="filled" className="profile-hub__feed-state">
        <Text variant="subheader-2">{isSelf ? profileHubStrings.feedEmptySelf : profileHubStrings.feedEmptyOther}</Text>
        {isSelf && (
          <Button view="action" size="m" onClick={onCreatePost}>{profileHubStrings.feedCreatePost}</Button>
        )}
      </Card>
    );
  }

  return (
    <div className="profile-hub__feed-list">
      {items.map((item) => (
        <PostCard key={`${item.id}`} item={item} />
      ))}
      {hasNextPage && (
        <Button view="flat" size="m" onClick={onLoadMore} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? <Loader size="s" /> : profileHubStrings.loadMore}
        </Button>
      )}
    </div>
  );
};
