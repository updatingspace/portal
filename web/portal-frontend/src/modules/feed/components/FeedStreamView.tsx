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
  canModerateNews: boolean;
  moderationMode: boolean;
  toggleModerationMode: () => void;
  selectedModerationCount: number;
  moderationReason: string;
  setModerationReason: (value: string) => void;
  moderationError: string | null;
  clearModerationSelection: () => void;
  handleModerationDeleteSelected: () => void;
  hasContent: boolean;
  isLoading: boolean;
  source: 'all' | 'news' | 'voting' | 'events';
  sortedItems: ActivityEvent[];
  draftItems?: ActivityEvent[];
  focusedNewsId?: string | null;
  selectedModerationIds: string[];
  getItemNewsId: (item: ActivityEvent) => string | null;
  handleModerationToggle: (newsId: string, selected: boolean) => void;
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
  canModerateNews,
  moderationMode,
  toggleModerationMode,
  selectedModerationCount,
  moderationReason,
  setModerationReason,
  moderationError,
  clearModerationSelection,
  handleModerationDeleteSelected,
  hasContent,
  isLoading,
  source,
  sortedItems,
  draftItems = [],
  focusedNewsId = null,
  selectedModerationIds,
  getItemNewsId,
  handleModerationToggle,
  loadMoreRef,
  isFetchingNextPage,
  hasNextPage,
}) => {
  const mobile = useMediaQuery('(max-width: 719px)');
  return (
    <>
      <div className="feed-stream__top">
        <div className="feed-stream__header">
          <div className="feed-stream__title">
            <h1>Лента</h1>
          </div>
          <div className="feed-stream__header-actions" data-qa="feed-actions">
            {mobile ? (
              <>
                {filters}
                <DropdownMenu
                  items={[
                    { text: 'Обновить', action: refetch },
                    ...(unreadCount > 0
                      ? [
                          {
                            text: 'Отметить прочитанным',
                            action: markAsRead,
                            disabled: isMarkingRead,
                          },
                        ]
                      : []),
                    ...(canModerateNews
                      ? [
                          {
                            text: moderationMode
                              ? 'Выйти из модерации'
                              : 'Режим модерации',
                            action: toggleModerationMode,
                          },
                        ]
                      : []),
                  ]}
                  renderSwitcher={(props) => (
                    <Button
                      {...props}
                      size="xl"
                      view="flat"
                      aria-label="Действия ленты"
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
                  Обновить
                </Button>
                {unreadCount > 0 && (
                  <Button
                    view="action"
                    size="m"
                    loading={isMarkingRead}
                    onClick={() => markAsRead()}
                  >
                    Отметить прочитанным
                  </Button>
                )}
                {canModerateNews && (
                  <Button
                    view={moderationMode ? 'outlined-danger' : 'outlined'}
                    size="m"
                    onClick={toggleModerationMode}
                    aria-label="Переключить режим модерации"
                  >
                    {moderationMode ? 'Выйти из модерации' : 'Режим модерации'}
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

      {moderationMode && (
        <Card
          view="filled"
          className="feed-moderation-panel"
          aria-live="polite"
        >
          <Text variant="subheader-2">Панель модерации</Text>
          <Text variant="caption-2" color="secondary">
            Горячая клавиша: Alt + M
          </Text>
          <Text variant="body-2" color="secondary">
            Выбрано: {selectedModerationCount} (максимум 20)
          </Text>
          <textarea
            className="feed-moderation-panel__reason"
            value={moderationReason}
            onChange={(event) => setModerationReason(event.target.value)}
            placeholder="Укажите причину модераторского действия (для аудита)"
            rows={2}
          />
          {moderationError && (
            <Text variant="caption-2" color="danger">
              {moderationError}
            </Text>
          )}
          <div className="feed-moderation-panel__actions">
            <Button view="outlined" size="m" onClick={clearModerationSelection}>
              Очистить выбор
            </Button>
            <Button
              view="flat-danger"
              size="m"
              onClick={handleModerationDeleteSelected}
            >
              Удалить выбранные
            </Button>
          </div>
        </Card>
      )}

      {unreadCount > 0 && (
        <Button view="outlined" size="xl" onClick={refetch}>
          Новые записи · {unreadCount}
        </Button>
      )}

      {draftItems.length > 0 && (
        <details className="feed-drafts" data-qa="feed-drafts">
          <summary className="feed-drafts__header">
            Мои черновики · {draftItems.length}
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
              ? 'Нет событий под выбранные фильтры.'
              : 'В ленте пока тихо'}
          </Text>
          <Text variant="body-2" color="secondary">
            {source !== 'all'
              ? 'Выберите другой источник в фильтрах.'
              : 'Здесь появятся публикации и события сообщества.'}
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
                moderationMode={moderationMode}
                highlighted={Boolean(
                  focusedNewsId && itemNewsId === focusedNewsId,
                )}
                autoOpenComments={Boolean(
                  focusedNewsId && itemNewsId === focusedNewsId,
                )}
                moderationSelected={Boolean(
                  itemNewsId && selectedModerationIds.includes(itemNewsId),
                )}
                onModerationToggle={handleModerationToggle}
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
            Больше событий нет
          </Text>
        )}
      </div>
    </>
  );
};
