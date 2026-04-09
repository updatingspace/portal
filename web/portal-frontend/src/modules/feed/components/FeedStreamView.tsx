import React from 'react';
import { Button, Card, Icon, Loader, Text } from '@gravity-ui/uikit';
import { ArrowRotateRight } from '@gravity-ui/icons';

import type { ActivityEvent } from '../../../types/activity';
import { SkeletonBlock } from '../../../shared/ui/skeleton/SkeletonBlock';
import { FeedItem } from './FeedItem';

type FeedStreamViewProps = {
  composer?: React.ReactNode;
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
  draftItems: ActivityEvent[];
  focusedNewsId: string | null;
  selectedModerationIds: string[];
  getItemNewsId: (item: ActivityEvent) => string | null;
  handleModerationToggle: (newsId: string, selected: boolean) => void;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
};

export const FeedStreamView: React.FC<FeedStreamViewProps> = ({
  composer,
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
}) => (
  <>
    <div className="feed-stream__top">
      <div className="feed-stream__header">
        <div className="feed-stream__title">
          <Text variant="header-1">Лента активности</Text>
          <Text variant="body-2" color="secondary" className="feed-stream__subtitle">
            Новости сообщества, голосования и игровые события в одном месте.
          </Text>
        </div>
        <div className="feed-stream__header-actions" data-qa="feed-actions">
          <Button view="flat" size="m" onClick={() => refetch()}>
            <Icon data={ArrowRotateRight} />
            Обновить
          </Button>
          {unreadCount > 0 && (
            <Button view="action" size="m" loading={isMarkingRead} onClick={() => markAsRead()}>
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
        </div>
      </div>

      {composer ? <div className="feed-stream__composer-slot">{composer}</div> : null}
    </div>

    {moderationMode && (
      <Card view="filled" className="feed-moderation-panel" aria-live="polite">
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
          <Button view="flat-danger" size="m" onClick={handleModerationDeleteSelected}>
            Удалить выбранные
          </Button>
        </div>
      </Card>
    )}

    {unreadCount > 0 && (
      <Card view="filled" className="feed-unread-banner" data-qa="feed-unread-banner" aria-live="polite">
        <Text variant="subheader-2">Новых событий: {unreadCount}</Text>
        <Text variant="body-2" color="secondary">
          Обновите ленту или отметьте события прочитанными.
        </Text>
      </Card>
    )}

    {draftItems.length > 0 && (
      <div className="feed-drafts" data-qa="feed-drafts">
        <div className="feed-drafts__header">
          <Text variant="subheader-2">Мои черновики</Text>
          <Text variant="caption-2" color="secondary">
            Черновики видны только вам до публикации.
          </Text>
        </div>
        <div className="feed-drafts__list">
          {draftItems.map((item) => (
            <FeedItem
              key={`draft-${getItemNewsId(item) ?? item.id}`}
              item={item}
              showPayload={false}
            />
          ))}
        </div>
      </div>
    )}

    {!hasContent && isLoading ? (
      <div className="feed-stream__list" data-qa="feed-list-loading">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={`skeleton-${index}`} view="filled" className="feed-skeleton">
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
          {source !== 'all' ? 'Нет событий под выбранные фильтры.' : 'Пока нет новых событий.'}
        </Text>
        <Text variant="body-2" color="secondary">
          Попробуйте сменить фильтры или зайдите позже.
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
              highlighted={Boolean(focusedNewsId && itemNewsId === focusedNewsId)}
              autoOpenComments={Boolean(focusedNewsId && itemNewsId === focusedNewsId)}
              moderationSelected={Boolean(itemNewsId && selectedModerationIds.includes(itemNewsId))}
              onModerationToggle={handleModerationToggle}
            />
          );
        })}
      </div>
    )}

    <div ref={loadMoreRef} className="feed-stream__footer" data-qa="feed-footer">
      {isFetchingNextPage && <Loader size="m" />}
      {!hasNextPage && hasContent && (
        <Text variant="caption-2" color="secondary">
          Больше событий нет
        </Text>
      )}
    </div>
  </>
);
