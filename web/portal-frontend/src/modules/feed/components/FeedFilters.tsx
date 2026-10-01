import { useUITranslation } from '../../../shared/ui/portal/PortalUI';
/**
 * FeedFilters Component
 *
 * Sidebar filters for the activity feed.
 */

import React from 'react';
import { Select, Button, Text } from '@gravity-ui/uikit';

export interface FeedFiltersProps {
  sortValue: string;
  onSortChange: (value: string) => void;
  sourceValue: string;
  onSourceChange: (value: string) => void;
  timeValue: string;
  onTimeChange: (value: string) => void;
  onReset?: () => void;
  qa?: string;
}

export const FeedFilters: React.FC<FeedFiltersProps> = ({
  sortValue,
  onSortChange,
  sourceValue,
  onSourceChange,
  timeValue,
  onTimeChange,
  onReset,
  qa,
}) => {
  const t = useUITranslation();
  const SORT_OPTIONS = [
    {
      value: 'best',
      content: t('Популярное из загруженного', 'Popular among loaded posts'),
    },
    { value: 'recent', content: t('Свежее', 'Recent') },
  ];

  const SOURCE_OPTIONS = [
    { value: 'all', content: t('Все посты', 'All posts') },
    { value: 'news', content: t('Новости сообщества', 'Community posts') },
    { value: 'voting', content: t('Голосования', 'Polls') },
    { value: 'events', content: t('Игровые события', 'Events') },
  ];

  const TIME_OPTIONS = [
    { value: 'week', content: t('За последнюю неделю', 'Past week') },
    { value: 'day', content: t('За 24 часа', 'Past 24 hours') },
    { value: 'month', content: t('За месяц', 'Past month') },
    { value: 'all', content: t('За всё время', 'All time') },
  ];

  const hasFilters =
    sortValue !== 'best' || sourceValue !== 'all' || timeValue !== 'week';

  return (
    <div className="feed-filters" data-qa={qa}>
      <div className="feed-filters__group">
        <Text variant="body-2" color="secondary">
          {t('Сортировка', 'Sort')}
        </Text>
        <Select
          size="xl"
          aria-label={t('Сортировка', 'Sort')}
          value={[sortValue]}
          onUpdate={(values) => onSortChange((values[0] ?? 'recent') as string)}
          options={SORT_OPTIONS}
          width="max"
        />
      </div>

      <div className="feed-filters__group">
        <Text variant="body-2" color="secondary">
          {t('Источник', 'Source')}
        </Text>
        <Select
          size="xl"
          aria-label={t('Источник', 'Source')}
          value={[sourceValue]}
          onUpdate={(values) => onSourceChange((values[0] ?? 'all') as string)}
          options={SOURCE_OPTIONS}
          width="max"
        />
      </div>

      <div className="feed-filters__group">
        <Text variant="body-2" color="secondary">
          {t('Время', 'Time')}
        </Text>
        <Select
          size="xl"
          aria-label={t('Время', 'Time')}
          value={[timeValue]}
          onUpdate={(values) => onTimeChange((values[0] ?? 'week') as string)}
          options={TIME_OPTIONS}
          width="max"
        />
      </div>

      {hasFilters && onReset && (
        <Button
          view="flat"
          size="xl"
          className="feed-filters__reset"
          onClick={onReset}
        >
          {t('Сбросить фильтры', 'Clear filters')}
        </Button>
      )}
    </div>
  );
};
