import React from 'react';
import { Card, Label, Text } from '@gravity-ui/uikit';

import { FeedFilters } from './FeedFilters';

type FeedControlRailProps = {
  source: 'all' | 'news' | 'voting' | 'events';
  sort: 'best' | 'recent';
  period: 'day' | 'week' | 'month' | 'all';
  setSort: (value: 'best' | 'recent') => void;
  setSource: (value: 'all' | 'news' | 'voting' | 'events') => void;
  setPeriod: (value: 'day' | 'week' | 'month' | 'all') => void;
  resetFilters: () => void;
  realtimeFlagEnabled: boolean;
};

export const FeedControlRail: React.FC<FeedControlRailProps> = ({
  source,
  sort,
  period,
  setSort,
  setSource,
  setPeriod,
  resetFilters,
  realtimeFlagEnabled,
}) => (
  <aside className="feed-sidebar" data-qa="feed-sidebar">
    <Card view="filled" className="feed-panel">
      <div className="feed-panel__header">
        <Text variant="subheader-2">Фильтры</Text>
        {source !== 'all' && (
          <Label size="xs" theme="info">
            1
          </Label>
        )}
      </div>
      <FeedFilters
        sortValue={sort}
        onSortChange={(value) => setSort(value as 'best' | 'recent')}
        sourceValue={source}
        onSourceChange={(value) => setSource(value as 'all' | 'news' | 'voting' | 'events')}
        timeValue={period}
        onTimeChange={(value) => setPeriod(value as 'day' | 'week' | 'month' | 'all')}
        onReset={resetFilters}
        qa="feed-filters"
      />
      <Text variant="caption-2" color="secondary">
        Realtime: {realtimeFlagEnabled ? 'включен флагом' : 'выключен (безопасный режим)'}
      </Text>
    </Card>
  </aside>
);
