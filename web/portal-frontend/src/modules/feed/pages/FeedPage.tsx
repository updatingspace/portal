import { useUITranslation } from '../../../shared/ui/portal/PortalUI';
import { InlineError } from '../../../shared/ui/portal/PortalUI';
import React from 'react';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import { Button, Card, Loader, Text } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';

import {
  createClientAccessDeniedError,
  toAccessDeniedError,
} from '../../../api/accessDenied';
import { isApiError } from '../../../api/client';
import { AccessDeniedScreen } from '../../../features/access-denied';
import { FeedComposerPanel } from '../components/FeedComposerPanel';
import { FeedControlRail } from '../components/FeedControlRail';
import { FeedItem } from '../components/FeedItem';
import { FeedStreamView } from '../components/FeedStreamView';
import { useFeedPageController } from '../hooks/useFeedPageController';
import './feed-page.css';

export const FeedPage: React.FC = () => {
  const t = useUITranslation();
  const controller = useFeedPageController();
  const navigate = useNavigate();
  const compact = useMediaQuery('(max-width: 1100px)');

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

  if (controller.error && !controller.hasContent) {
    const deniedError = toAccessDeniedError(controller.error, {
      source: 'api',
      tenant: controller.user?.tenant,
    });
    if (deniedError) {
      return <AccessDeniedScreen error={deniedError} />;
    }

    if (controller.isPermalinkView) {
      const isNotFound =
        isApiError(controller.error) && controller.error.kind === 'not_found';
      return (
        <div className="feed-page feed-page--single" data-qa="feed-page">
          <div className="feed-page__single">
            <div className="feed-page__single-back">
              <Button
                view="flat"
                size="m"
                onClick={() => navigate('..', { relative: 'path' })}
              >
                {t('К ленте', 'Back to feed')}
              </Button>
            </div>
            <Card
              view="filled"
              className="feed-empty"
              data-qa="feed-single-error"
            >
              <Text variant="subheader-2">
                {isNotFound
                  ? t('Пост не найден.', 'Post not found.')
                  : t(
                      'Не удалось загрузить публикацию.',
                      'Unable to load this post.',
                    )}
              </Text>
              <Text variant="body-2" color="secondary">
                {isNotFound
                  ? t(
                      'Проверьте ссылку или вернитесь к общей ленте.',
                      'Check the link or return to the feed.',
                    )
                  : t(
                      'Попробуйте обновить страницу.',
                      'Try refreshing the page.',
                    )}
              </Text>
              <Button
                view="flat"
                size="m"
                onClick={() =>
                  isNotFound
                    ? navigate('..', { relative: 'path' })
                    : controller.refetch()
                }
              >
                {isNotFound
                  ? t('К ленте', 'Back to feed')
                  : t('Повторить', 'Try again')}
              </Button>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="feed-page" data-qa="feed-page">
        <Card view="filled" className="feed-empty" data-qa="feed-error">
          <Text variant="subheader-2">
            {t('Не удалось загрузить ленту.', 'Unable to load the feed.')}
          </Text>
          <Text variant="body-2" color="secondary">
            {t('Попробуйте обновить страницу.', 'Try refreshing the page.')}
          </Text>
          <Button view="flat" size="m" onClick={() => controller.refetch()}>
            {t('Повторить', 'Try again')}
          </Button>
        </Card>
      </div>
    );
  }

  if (controller.isPermalinkView) {
    return (
      <div className="feed-page feed-page--single" data-qa="feed-page">
        <div className="feed-page__single">
          <div className="feed-page__single-back">
            <Button
              view="flat"
              size="m"
              onClick={() => navigate('..', { relative: 'path' })}
            >
              {t('К ленте', 'Back to feed')}
            </Button>
          </div>

          {controller.isLoading ? (
            <Card
              view="filled"
              className="feed-page__single-loading"
              data-qa="feed-single-loading"
            >
              <Loader size="m" />
              <Text variant="body-2" color="secondary">
                Загружаем публикацию...
              </Text>
            </Card>
          ) : controller.focusedNews ? (
            <div className="feed-page__single-card" data-qa="feed-single-card">
              <FeedItem
                item={controller.focusedNews}
                showPayload={false}
                highlighted
                autoOpenComments
              />
            </div>
          ) : (
            <Card
              view="filled"
              className="feed-empty"
              data-qa="feed-single-empty"
            >
              <Text variant="subheader-2">
                {t('Пост не найден.', 'Post not found.')}
              </Text>
              <Text variant="body-2" color="secondary">
                {t(
                  'Проверьте ссылку или вернитесь к общей ленте.',
                  'Check the link or return to the feed.',
                )}
              </Text>
            </Card>
          )}
        </div>
      </div>
    );
  }

  const filters = (
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
  );

  return (
    <div className="feed-page" data-qa="feed-page">
      <div className="feed-page__layout">
        {controller.draftGuard}
        <section className="feed-stream">
          {controller.error && (
            <InlineError onRetry={() => void controller.refetch()}>
              Не удалось обновить ленту. Уже загруженные публикации доступны.
            </InlineError>
          )}
          {controller.publishError && !controller.composerOpen && (
            <InlineError>{controller.publishError}</InlineError>
          )}
          <FeedStreamView
            filters={compact ? filters : undefined}
            composer={
              <FeedComposerPanel
                publishError={controller.publishError}
                canCreateNews={controller.canCreateNews}
                composerOpen={controller.composerOpen}
                setComposerOpen={controller.setComposerOpen}
                composerValue={controller.composerValue}
                setComposerValue={controller.setComposerValue}
                fileInputRef={controller.fileInputRef}
                handleImageUpload={controller.handleImageUpload}
                detectedTags={controller.detectedTags}
                publishMode={controller.publishMode}
                setPublishMode={controller.setPublishMode}
                isCreatingNews={controller.isCreatingNews}
                uploading={controller.uploading}
                canPublishNews={controller.canPublishNews}
                handlePublishNews={controller.handlePublishNews}
                handleComposerKeyDown={controller.handleComposerKeyDown}
                newsMedia={controller.newsMedia}
                handleRemoveMedia={controller.handleRemoveMedia}
              />
            }
            unreadCount={controller.unreadCount}
            refetch={controller.refetch}
            isMarkingRead={controller.isMarkingRead}
            markAsRead={() => controller.markAsRead()}
            hasContent={controller.hasContent}
            isLoading={controller.isLoading}
            source={controller.source}
            sortedItems={controller.sortedItems}
            draftItems={controller.draftItems}
            focusedNewsId={controller.focusedNewsId ?? null}
            getItemNewsId={controller.getItemNewsId}
            loadMoreRef={controller.loadMoreRef}
            isFetchingNextPage={controller.isFetchingNextPage}
            hasNextPage={controller.hasNextPage}
          />
          {controller.hasNextPage && (
            <Button
              loading={controller.isFetchingNextPage}
              disabled={controller.isFetchingNextPage}
              onClick={() => void controller.fetchNextPage()}
            >
              Загрузить ещё
            </Button>
          )}
        </section>
        {!compact && filters}
      </div>
    </div>
  );
};
