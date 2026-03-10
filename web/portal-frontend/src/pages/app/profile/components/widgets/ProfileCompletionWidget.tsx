import React, { useMemo } from 'react';
import { Button, Card, Text } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';

import { useRouteBase } from '../../../../../shared/hooks/useRouteBase';
import type { ProfileHubVM } from '../../model/types';
import { profileHubStrings } from '../../strings/ru';

type ProfileCompletionWidgetProps = {
  vm: ProfileHubVM;
};

export const ProfileCompletionWidget: React.FC<ProfileCompletionWidgetProps> = ({ vm }) => {
  const navigate = useNavigate();
  const routeBase = useRouteBase();
  const hasPublishedPost = vm.feed.items.some((item) => item.type === 'news.posted' || item.type === 'post.created');

  const checklist = useMemo(
    () => [
      { label: profileHubStrings.completion.checklist.avatar, done: Boolean(vm.owner.avatarUrl) },
      { label: profileHubStrings.completion.checklist.bio, done: Boolean(vm.owner.bio) },
      { label: profileHubStrings.completion.checklist.contacts, done: Boolean(vm.about.contacts?.length) },
      { label: profileHubStrings.completion.checklist.follows, done: vm.previews.following.length > 0 },
      { label: profileHubStrings.completion.checklist.firstPost, done: hasPublishedPost },
    ],
    [hasPublishedPost, vm.about.contacts?.length, vm.owner.avatarUrl, vm.owner.bio, vm.previews.following.length],
  );

  const completed = checklist.filter((item) => item.done).length;
  const progress = Math.round((completed / checklist.length) * 100);

  return (
    <Card view="filled" className="profile-widget">
      <div className="profile-widget__head">
        <Text variant="subheader-2">{profileHubStrings.completion.title}</Text>
        <Text variant="caption-2" color="secondary">{progress}%</Text>
      </div>
      <Text variant="body-2" color="secondary">{profileHubStrings.completion.hint}</Text>
      <ul className="profile-widget__checklist">
        {checklist.map((item) => (
          <li key={item.label} className={item.done ? 'is-done' : ''}>{item.label}</li>
        ))}
      </ul>
      <Button view="flat" size="s" onClick={() => navigate(`${routeBase}/settings`)}>
        {profileHubStrings.completion.cta}
      </Button>
    </Card>
  );
};
