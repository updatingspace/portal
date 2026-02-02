/**
 * FeedFilters Component
 *
 * Filter controls for the activity feed.
 */

import React, { useCallback } from 'react';
import { Select, Button, Flex } from '@gravity-ui/uikit';

// Available event types for filtering
const EVENT_TYPES: { value: string; label: string }[] = [
  { value: 'vote.cast', label: '🗳️ Голосования' },
  { value: 'event.created', label: '📅 События созданы' },
  { value: 'event.rsvp.changed', label: '✅ RSVP изменения' },
  { value: 'post.created', label: '📝 Посты' },
  { value: 'game.achievement', label: '🏆 Достижения' },
  { value: 'game.playtime', label: '🎮 Игровое время' },
  { value: 'minecraft.session', label: '⛏️ Minecraft' },
];

const formatDateInputValue = (date?: Date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value: string): Date | null => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

export interface FeedFiltersProps {
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
  fromDate?: Date;
  toDate?: Date;
  onFromDateChange?: (date: Date | null) => void;
  onToDateChange?: (date: Date | null) => void;
  onReset?: () => void;
}

export const FeedFilters: React.FC<FeedFiltersProps> = ({
  selectedTypes,
  onTypesChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onReset,
}) => {
  const handleTypesUpdate = useCallback(
    (values: string[]) => {
      onTypesChange(values);
    },
    [onTypesChange],
  );

  const handleFromDateUpdate = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onFromDateChange?.(parseDateInputValue(event.target.value));
    },
    [onFromDateChange],
  );

  const handleToDateUpdate = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onToDateChange?.(parseDateInputValue(event.target.value));
    },
    [onToDateChange],
  );

  const hasFilters = selectedTypes.length > 0 || fromDate || toDate;

  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
      <Flex gap={3} wrap>
        {/* Event Type Filter */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Тип события
          </label>
          <Select
            multiple
            filterable
            placeholder="Все типы"
            value={selectedTypes}
            onUpdate={handleTypesUpdate}
            options={EVENT_TYPES.map((t) => ({
              value: t.value,
              content: t.label,
            }))}
            width="max"
          />
        </div>

        {/* Date Range */}
        {onFromDateChange && (
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              От даты
            </label>
            <input
              type="date"
              value={formatDateInputValue(fromDate)}
              onChange={handleFromDateUpdate}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        )}

        {onToDateChange && (
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              До даты
            </label>
            <input
              type="date"
              value={formatDateInputValue(toDate)}
              onChange={handleToDateUpdate}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        )}

        {/* Reset Button */}
        {hasFilters && onReset && (
          <div className="flex items-end">
            <Button view="flat" onClick={onReset}>
              Сбросить
            </Button>
          </div>
        )}
      </Flex>
    </div>
  );
};
