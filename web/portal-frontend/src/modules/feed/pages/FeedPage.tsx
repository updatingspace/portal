import React from 'react';
import { Button, Card, Text } from '@gravity-ui/uikit';

import { createClientAccessDeniedError, toAccessDeniedError } from '../../../api/accessDenied';
import { AccessDeniedScreen } from '../../../features/access-denied';
import { FeedComposerPanel } from '../components/FeedComposerPanel';
import { FeedControlRail } from '../components/FeedControlRail';
import { FeedStreamView } from '../components/FeedStreamView';
import { useFeedPageController } from '../hooks/useFeedPageController';
import './feed-page.css';

export const FeedPage: React.FC = () => {
  const controller = useFeedPageController();

  if (!controller.canReadFeed) {
    return (
      <AccessDeniedScreen
        error={createClientAccessDeniedError({
          requiredPermission: 'activity.feed.read',
          tenant: controller.user?.tenant,
        })}
      />
    );
  }

  if (controller.error) {
    const deniedError = toAccessDeniedError(controller.error, { source: 'api', tenant: controller.user?.tenant });
    if (deniedError) {
      return <AccessDeniedScreen error={deniedError} />;
    }

    return (
      <div className="feed-page" data-qa="feed-page">
        <Card view="filled" className="feed-empty" data-qa="feed-error">
          <Text variant="subheader-2">Не удалось загрузить ленту.</Text>
          <Text variant="body-2" color="secondary">
            Попробуйте обновить страницу.
          </Text>
          <Button view="flat" size="m" onClick={() => controller.refetch()}>
            Повторить
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="feed-page" data-qa="feed-page">
      <div className="feed-page__layout">
        <section className="feed-stream">
          <FeedStreamView
            unreadCount={controller.unreadCount}
            refetch={controller.refetch}
            isMarkingRead={controller.isMarkingRead}
            markAsRead={() => controller.markAsRead()}
            canModerateNews={controller.canModerateNews}
            moderationMode={controller.moderationMode}
            toggleModerationMode={controller.toggleModerationMode}
            selectedModerationCount={controller.selectedModerationIds.length}
            moderationReason={controller.moderationReason}
            setModerationReason={controller.setModerationReason}
            moderationError={controller.moderationError}
            clearModerationSelection={() => controller.setSelectedModerationIds([])}
            handleModerationDeleteSelected={controller.handleModerationDeleteSelected}
            hasContent={controller.hasContent}
            isLoading={controller.isLoading}
            source={controller.source}
            sortedItems={controller.sortedItems}
            selectedModerationIds={controller.selectedModerationIds}
            getItemNewsId={controller.getItemNewsId}
            handleModerationToggle={controller.handleModerationToggle}
            loadMoreRef={controller.loadMoreRef}
            isFetchingNextPage={controller.isFetchingNextPage}
            hasNextPage={controller.hasNextPage}
          />
          <FeedComposerPanel
            canCreateNews={controller.canCreateNews}
            composerOpen={controller.composerOpen}
            setComposerOpen={controller.setComposerOpen}
            emptyToolbarsPreset={controller.emptyToolbarsPreset}
            editor={controller.editor}
            fileInputRef={controller.fileInputRef}
            handleImageUpload={controller.handleImageUpload}
            detectedTags={controller.detectedTags}
            composerError={controller.composerError}
            newsVisibility={controller.newsVisibility}
            setNewsVisibility={controller.setNewsVisibility}
            isCreatingNews={controller.isCreatingNews}
            uploading={controller.uploading}
            composerHasText={controller.composerHasText}
            composerHasMedia={controller.composerHasMedia}
            handlePublishNews={controller.handlePublishNews}
            newsMedia={controller.newsMedia}
            handleRemoveMedia={controller.handleRemoveMedia}
          />
        </section>
        <FeedControlRail
          source={controller.source}
          sort={controller.sort}
          period={controller.period}
          setSort={controller.setSort}
          setSource={controller.setSource}
          setPeriod={controller.setPeriod}
          resetFilters={controller.resetFilters}
          realtimeFlagEnabled={controller.realtimeFlagEnabled}
        />
      </div>
    </div>
  );
};
