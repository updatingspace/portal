import { useUITranslation } from '../../../shared/ui/portal/PortalUI';
import React from 'react';
import {
  Button,
  Card,
  DropdownMenu,
  Icon,
  Loader,
  Text,
} from '@gravity-ui/uikit';
import { Ellipsis, ArrowRotateRight } from '@gravity-ui/icons';

import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import type { ActivityEvent } from '../../../types/activity';
import { SkeletonBlock } from '../../../shared/ui/skeleton/SkeletonBlock';
import { FeedItem } from './FeedItem';

type FeedStreamViewProps = {
  composer?: React.ReactNode;
  filters?: React.ReactNode;
  unreadCount: number;
  refetch: () => void;
  isMarkingRead: boolean;
  markAsRead: () => void;
  hasContent: boolean;
  isLoading: boolean;
  source: 'all' | 'news' | 'voting' | 'events';
  sortedItems: ActivityEvent[];
  draftItems?: ActivityEvent[];
  focusedNewsId?: string | null;
  getItemNewsId: (item: ActivityEvent) => string | null;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
};

export const FeedStreamView: React.FC<FeedStreamViewProps> = ({
  composer,
  filters,
  unreadCount,
  refetch,
  isMarkingRead,
  markAsRead,
  hasContent,
  isLoading,
  source,
  sortedItems,
  draftItems = [],
  focusedNewsId = null,
  getItemNewsId,
  loadMoreRef,
  isFetchingNextPage,
  hasNextPage,
}) => {
  const t = useUITranslation();
  const mobile = useMediaQuery('(max-width: 719px)');
  return (
    <>
      <div className="feed-stream__top">
        <div className="feed-stream__header">
          <div className="feed-stream__title">
            <h1>{t('Лента', 'Activity feed')}</h1>
          </div>
          <div className="feed-stream__header-actions" data-qa="feed-actions">
            {mobile ? (
              <>
                {filters}
                <DropdownMenu
                  items={[
                    { text: t('Обновить', 'Refresh'), action: refetch },
                    ...(unreadCount > 0
                      ? [
                          {
                            text: t('Отметить прочитанным', 'Mark as read'),
                            action: markAsRead,
                            disabled: isMarkingRead,
                          },
                        ]
                      : []),
                  ]}
                  renderSwitcher={(props) => (
                    <Button
                      {...props}
                      size="xl"
                      view="flat"
                      aria-label={t('Действия ленты', 'Feed actions')}
                    >
                      <Icon data={Ellipsis} size={20} />
                    </Button>
                  )}
                />
                {composer}
              </>
            ) : (
              <>
                {' '}
                <Button view="flat" size="m" onClick={() => refetch()}>
                  <Icon data={ArrowRotateRight} />
                  {t('Обновить', 'Refresh')}
                </Button>
                {unreadCount > 0 && (
                  <Button
                    view="action"
                    size="m"
                    loading={isMarkingRead}
                    onClick={() => markAsRead()}
                  >
                    {t('Отметить прочитанным', 'Mark as read')}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {!mobile && filters}
        {!mobile && composer ? (
          <div className="feed-stream__composer-slot">{composer}</div>
        ) : null}
      </div>

      {unreadCount > 0 && (
        <Button view="outlined" size="xl" onClick={refetch}>
          {t('Новые записи', 'New posts')} · {unreadCount}
        </Button>
      )}

      {draftItems.length > 0 && (
        <details className="feed-drafts" data-qa="feed-drafts">
          <summary className="feed-drafts__header">
            {t('Мои черновики', 'My drafts')} · {draftItems.length}
          </summary>
          <div className="feed-drafts__list">
            {draftItems.map((item) => (
              <FeedItem
                key={`draft-${getItemNewsId(item) ?? item.id}`}
                item={item}
                showPayload={false}
              />
            ))}
          </div>
        </details>
      )}

      {!hasContent && isLoading ? (
        <div className="feed-stream__list" data-qa="feed-list-loading">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card
              key={`skeleton-${index}`}
              view="filled"
              className="feed-skeleton"
            >
              <div className="feed-skeleton__row">
                <SkeletonBlock height={32} width="32px" />
                <div className="feed-skeleton__content">
                  <SkeletonBlock height={12} width="40%" />
                  <SkeletonBlock height={18} width="70%" />
                  <SkeletonBlock height={12} width="60%" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : !hasContent ? (
        <Card view="filled" className="feed-empty" data-qa="feed-empty">
          <Text variant="subheader-2">
            {source !== 'all'
              ? t(
                  'Нет событий под выбранные фильтры.',
                  'No posts match these filters.',
                )
              : t('В ленте пока тихо', 'No posts yet')}
          </Text>
          <Text variant="body-2" color="secondary">
            {source !== 'all'
              ? t('Выберите другой источник в фильтрах.', 'Try another source.')
              : t(
                  'Здесь появятся публикации и события сообщества.',
                  'Community posts and events will appear here.',
                )}
          </Text>
        </Card>
      ) : (
        <div className="feed-stream__list" data-qa="feed-list">
          {sortedItems.map((item) => {
            const itemNewsId = getItemNewsId(item);
            return (
              <FeedItem
                key={item.id}
                item={item}
                showPayload={false}
                highlighted={Boolean(
                  focusedNewsId && itemNewsId === focusedNewsId,
                )}
                autoOpenComments={Boolean(
                  focusedNewsId && itemNewsId === focusedNewsId,
                )}
              />
            );
          })}
        </div>
      )}

      <div
        ref={loadMoreRef}
        className="feed-stream__footer"
        data-qa="feed-footer"
      >
        {isFetchingNextPage && <Loader size="m" />}
        {!hasNextPage && hasContent && (
          <Text variant="caption-2" color="secondary">
            {t('Больше событий нет', 'You’re all caught up')}
          </Text>
        )}
      </div>
    </>
  );
};
