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

const SORT_OPTIONS = [
  { value: 'best', content: 'Лучшее' },
  { value: 'recent', content: 'Свежее' },
];

const SOURCE_OPTIONS = [
  { value: 'all', content: 'Все посты' },
  { value: 'news', content: 'Новости сообщества' },
  { value: 'voting', content: 'Голосования' },
  { value: 'events', content: 'Игровые события' },
];

const TIME_OPTIONS = [
  { value: 'week', content: 'За последнюю неделю' },
  { value: 'day', content: 'За 24 часа' },
  { value: 'month', content: 'За месяц' },
  { value: 'all', content: 'За всё время' },
];

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
  const hasFilters = sortValue !== 'recent' || sourceValue !== 'all' || timeValue !== 'week';

  return (
    <div className="feed-filters" data-qa={qa}>
      <div className="feed-filters__group">
        <Text variant="body-2" color="secondary">
          Сортировка
        </Text>
        <Select
          value={[sortValue]}
          onUpdate={(values) => onSortChange((values[0] ?? 'recent') as string)}
          options={SORT_OPTIONS}
          width="max"
        />
      </div>

      <div className="feed-filters__group">
        <Text variant="body-2" color="secondary">
          Источник
        </Text>
        <Select
          value={[sourceValue]}
          onUpdate={(values) => onSourceChange((values[0] ?? 'all') as string)}
          options={SOURCE_OPTIONS}
          width="max"
        />
      </div>

      <div className="feed-filters__group">
        <Text variant="body-2" color="secondary">
          Время
        </Text>
        <Select
          value={[timeValue]}
          onUpdate={(values) => onTimeChange((values[0] ?? 'week') as string)}
          options={TIME_OPTIONS}
          width="max"
        />
      </div>

      {hasFilters && onReset && (
        <Button view="flat" size="m" className="feed-filters__reset" onClick={onReset}>
          Сбросить фильтры
        </Button>
      )}
    </div>
  );
};
