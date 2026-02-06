import React, { useMemo, useState } from 'react';

import { createClientAccessDeniedError } from '../../../api/accessDenied';
import { useCreateNews } from '../../../hooks/useActivity';
import { useProfileSession } from './model/useProfileSession';
import { useProfileHubData } from './model/useProfileHubData';
import { FeedFilters, type FeedSegment } from './components/FeedFilters';
import { ProfileFeed } from './components/ProfileFeed';
import { ProfileHeaderCard } from './components/ProfileHeaderCard';
import { CreatePostComposer } from './components/CreatePostComposer';
import { AccessDeniedScreen } from '../../../features/access-denied';
import { profileHubStrings } from './strings/ru';
import { ProfileHeaderSkeleton } from './components/ProfileHeaderSkeleton';
import { CreatePostComposerSkeleton } from './components/CreatePostComposerSkeleton';
import { AboutWidget } from './components/widgets/AboutWidget';
import { AchievementsWidget } from './components/widgets/AchievementsWidget';
import { FollowingWidget } from './components/widgets/FollowingWidget';
import { FollowersWidget } from './components/widgets/FollowersWidget';
import { CommunitiesWidget } from './components/widgets/CommunitiesWidget';
import { FriendsWidget } from './components/widgets/FriendsWidget';
import { ProfileCompletionWidget } from './components/widgets/ProfileCompletionWidget';
import { WidgetSkeleton } from './components/widgets/WidgetSkeleton';
import { toaster } from '../../../toaster';
import './profile-hub.css';

const isPostItem = (type: string): boolean => type === 'news.posted' || type === 'post.created';
const isMediaItem = (item: { payloadJson: Record<string, unknown> }): boolean =>
  Array.isArray((item.payloadJson as { media?: unknown[] }).media) && ((item.payloadJson as { media?: unknown[] }).media?.length ?? 0) > 0;
const isPinnedItem = (item: { payloadJson: Record<string, unknown> }): boolean =>
  (item.payloadJson as { pinned?: boolean }).pinned === true;

export const ProfileHubPage: React.FC = () => {
  const [activeSegment, setActiveSegment] = useState<FeedSegment>('posts');
  const { sessionInfo } = useProfileSession();
  const { mutateAsync: createNews } = useCreateNews();
  const {
    vm,
    isLoading,
    isFeedLoading,
    feedError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetchFeed,
  } = useProfileHubData(sessionInfo);

  const filteredItems = useMemo(() => {
    if (!vm) return [];
    if (activeSegment === 'posts') return vm.feed.items.filter((item) => isPostItem(item.type));
    if (activeSegment === 'activity') return vm.feed.items;
    if (activeSegment === 'media') return vm.feed.items.filter((item) => isMediaItem(item));
    if (activeSegment === 'pinned') return vm.feed.items.filter((item) => isPinnedItem(item));
    return vm.feed.items;
  }, [activeSegment, vm]);

  const segments = useMemo<FeedSegment[]>(() => {
    if (!vm) return ['posts'];
    const items = vm.feed.items;
    const available: FeedSegment[] = ['posts'];
    if (items.some((item) => !isPostItem(item.type))) available.push('activity');
    if (items.some((item) => isMediaItem(item))) available.push('media');
    if (items.some((item) => isPinnedItem(item))) available.push('pinned');
    return available;
  }, [vm]);

  const handlePublish = async (body: string) => {
    try {
      await createNews({
        body,
        title: null,
        tags: [],
        visibility: 'public',
        scopeType: 'TENANT',
        scopeId: null,
        media: [],
      });
      toaster.add({
        name: `profile-published-${Date.now()}`,
        title: profileHubStrings.publishSuccess,
        theme: 'success',
      });
      await refetchFeed();
    } catch {
      toaster.add({
        name: `profile-publish-failed-${Date.now()}`,
        title: profileHubStrings.publishError,
        theme: 'danger',
      });
      return;
    }
  };

  if (!vm) {
    return null;
  }

  if (!vm.capabilities.canViewProfile) {
    return (
      <AccessDeniedScreen
        error={createClientAccessDeniedError({
          requiredPermission: 'portal.profile.read_self',
          tenant: sessionInfo?.tenant,
        })}
      />
    );
  }

  return (
    <div className="profile-hub">
      {isLoading ? (
        <ProfileHeaderSkeleton />
      ) : (
        <ProfileHeaderCard
          owner={vm.owner}
          isSelf={vm.viewer.isSelf}
          canEditProfile={vm.capabilities.canEditProfile}
        />
      )}

      <div className="profile-hub__layout">
        <section className="profile-hub__main">
          {isLoading ? (
            <CreatePostComposerSkeleton />
          ) : (
            <CreatePostComposer canCreatePost={vm.capabilities.canCreatePost} onPublish={handlePublish} />
          )}

          <FeedFilters
            segments={segments}
            active={segments.includes(activeSegment) ? activeSegment : 'posts'}
            onChange={setActiveSegment}
          />

          <ProfileFeed
            items={filteredItems}
            isLoading={isFeedLoading}
            isError={Boolean(feedError)}
            isSelf={vm.viewer.isSelf}
            canViewPosts={vm.capabilities.canViewPosts}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onRetry={() => {
              void refetchFeed();
            }}
            onLoadMore={() => {
              void fetchNextPage();
            }}
            onCreatePost={() => {
              const element = document.querySelector('.profile-hub__composer textarea');
              if (element instanceof HTMLTextAreaElement) {
                element.focus();
              }
            }}
          />
        </section>

        <aside className="profile-hub__right">
          {isLoading ? (
            <>
              <WidgetSkeleton />
              <WidgetSkeleton />
              <WidgetSkeleton />
            </>
          ) : (
            <>
              <AboutWidget
                language={vm.about.language}
                timezone={vm.about.timezone}
                contacts={vm.about.contacts}
                isSelf={vm.viewer.isSelf}
              />
              <AchievementsWidget items={vm.previews.achievements} />
              <FollowingWidget items={vm.previews.following} />
              <FollowersWidget items={vm.previews.followers} />
              <CommunitiesWidget items={vm.previews.communities} />
              <FriendsWidget items={vm.previews.friends} />
              <ProfileCompletionWidget vm={vm} />
            </>
          )}
        </aside>
      </div>

    </div>
  );
};
