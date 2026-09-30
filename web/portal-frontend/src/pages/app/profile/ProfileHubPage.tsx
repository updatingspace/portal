import React, { useMemo, useState } from 'react';

import { Button, Icon } from '@gravity-ui/uikit';
import { Plus } from '@gravity-ui/icons';
import { Link } from 'react-router-dom';
import { ContentDialog } from '../../../shared/ui/portal/ContentDialog';
import { useUITranslation } from '../../../shared/ui/portal/PortalUI';
import { useRouteBase } from '../../../shared/hooks/useRouteBase';
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
import { toaster } from '../../../toaster';
import './profile-hub.css';

const isPostItem = (type: string): boolean =>
  type === 'news.posted' || type === 'post.created';
const isMediaItem = (item: { payloadJson: Record<string, unknown> }): boolean =>
  Array.isArray((item.payloadJson as { media?: unknown[] }).media) &&
  ((item.payloadJson as { media?: unknown[] }).media?.length ?? 0) > 0;
const isPinnedItem = (item: {
  payloadJson: Record<string, unknown>;
}): boolean => (item.payloadJson as { pinned?: boolean }).pinned === true;

export const ProfileHubPage: React.FC = () => {
  const t = useUITranslation();
  const routeBase = useRouteBase();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
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
  } = useProfileHubData(sessionInfo, { loadPreviews: false });

  const filteredItems = useMemo(() => {
    if (!vm) return [];
    if (activeSegment === 'posts')
      return vm.feed.items.filter((item) => isPostItem(item.type));
    if (activeSegment === 'activity') return vm.feed.items;
    if (activeSegment === 'media')
      return vm.feed.items.filter((item) => isMediaItem(item));
    if (activeSegment === 'pinned')
      return vm.feed.items.filter((item) => isPinnedItem(item));
    return vm.feed.items;
  }, [activeSegment, vm]);

  const segments = useMemo<FeedSegment[]>(() => {
    if (!vm) return ['posts'];
    const items = vm.feed.items;
    const available: FeedSegment[] = ['posts'];
    if (items.some((item) => !isPostItem(item.type)))
      available.push('activity');
    if (items.some((item) => isMediaItem(item))) available.push('media');
    if (items.some((item) => isPinnedItem(item))) available.push('pinned');
    return available;
  }, [vm]);

  const handlePublish = async (body: string) => {
    setPublishing(true);
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
      // Publication is confirmed. A failed refresh must not invite a duplicate write.
      void refetchFeed().catch(() => undefined);
    } catch (error) {
      toaster.add({
        name: `profile-publish-failed-${Date.now()}`,
        title: profileHubStrings.publishError,
        theme: 'danger',
      });
      throw error;
    } finally {
      setPublishing(false);
    }
  };

  if (!vm) {
    return <ProfileHeaderSkeleton />;
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

  const canWrite = vm.viewer.isSelf && vm.capabilities.canCreatePost;
  const hasItems = vm.feed.items.length > 0;
  return (
    <div className="profile-hub">
      {isLoading ? (
        <ProfileHeaderSkeleton />
      ) : (
        <ProfileHeaderCard
          owner={vm.owner}
          isSelf={vm.viewer.isSelf}
          canEditProfile={vm.capabilities.canEditProfile}
          onDetails={() => setDetailsOpen(true)}
        />
      )}
      <section
        className="profile-hub__main"
        aria-label={t('Публикации', 'Posts')}
      >
        <div className="profile-hub__section-heading">
          <h2>{t('Публикации', 'Posts')}</h2>
          {canWrite && (hasItems || Boolean(feedError)) && (
            <Button
              size="xl"
              view="flat"
              aria-label={t('Написать публикацию', 'Write a post')}
              onClick={() => setComposerOpen(true)}
            >
              <Icon data={Plus} />
              {t('Написать', 'Write')}
            </Button>
          )}
        </div>
        {segments.length > 1 && (
          <FeedFilters
            segments={segments}
            active={segments.includes(activeSegment) ? activeSegment : 'posts'}
            onChange={setActiveSegment}
          />
        )}
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
          onCreatePost={
            canWrite && !hasItems ? () => setComposerOpen(true) : undefined
          }
        />
      </section>
      {detailsOpen && (
        <ContentDialog
          title={t('О профиле', 'Profile details')}
          onClose={() => setDetailsOpen(false)}
        >
          <dl className="profile-details">
            <div>
              <dt>{t('Имя', 'Name')}</dt>
              <dd>{vm.owner.tenantDisplayName}</dd>
            </div>
            {vm.owner.bio && (
              <div>
                <dt>{t('О себе', 'About')}</dt>
                <dd>{vm.owner.bio}</dd>
              </div>
            )}
            {vm.about.language && (
              <div>
                <dt>{t('Язык', 'Language')}</dt>
                <dd>
                  {vm.about.language === 'ru'
                    ? 'Русский'
                    : vm.about.language === 'en'
                      ? 'English'
                      : vm.about.language}
                </dd>
              </div>
            )}
            {vm.about.timezone && (
              <div>
                <dt>{t('Часовой пояс', 'Time zone')}</dt>
                <dd>{vm.about.timezone}</dd>
              </div>
            )}
            {vm.about.contacts?.length ? (
              <div>
                <dt>{t('Контакты', 'Contact')}</dt>
                <dd>{vm.about.contacts.join(', ')}</dd>
              </div>
            ) : null}
          </dl>
          <nav
            className="profile-details__links"
            aria-label={t('Разделы профиля', 'Profile sections')}
          >
            <Link to={`${routeBase}/profile/achievements`}>
              {t('Мои достижения', 'My achievements')}
              <span aria-hidden="true">›</span>
            </Link>
            <Link to={`${routeBase}/profile/communities`}>
              {t('Мои сообщества', 'My communities')}
              <span aria-hidden="true">›</span>
            </Link>
          </nav>
        </ContentDialog>
      )}
      {composerOpen && (
        <ContentDialog
          busy={publishing}
          title={t('Новая публикация', 'New post')}
          onClose={() => setComposerOpen(false)}
        >
          <CreatePostComposer
            canCreatePost={vm.capabilities.canCreatePost}
            onPublish={handlePublish}
            onPublished={() => setComposerOpen(false)}
          />
        </ContentDialog>
      )}
    </div>
  );
};
