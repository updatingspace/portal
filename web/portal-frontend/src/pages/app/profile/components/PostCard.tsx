import React from 'react';

import type { ActivityEvent } from '../../../../types/activity';
import { FeedItem } from '../../../../modules/feed/components/FeedItem';

type PostCardProps = {
  item: ActivityEvent;
};

export const PostCard: React.FC<PostCardProps> = ({ item }) => {
  return <FeedItem item={item} showPayload={false} />;
};
