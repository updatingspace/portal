import { useUITranslation } from '../../../shared/ui/portal/PortalUI';
import React, { useState } from 'react';
import { Button, Icon, Text } from '@gravity-ui/uikit';

import { Sliders } from '@gravity-ui/icons';
import { ContentDialog } from '../../../shared/ui/portal/ContentDialog';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
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
}) => {
  const t = useUITranslation();
  const compact = useMediaQuery('(max-width: 1100px)');
  const [open, setOpen] = useState(false);
  const hasFilters = source !== 'all' || sort !== 'best' || period !== 'week';
  const controls = (
    <FeedFilters
      sortValue={sort}
      onSortChange={(value) => setSort(value as 'best' | 'recent')}
      sourceValue={source}
      onSourceChange={(value) =>
        setSource(value as 'all' | 'news' | 'voting' | 'events')
      }
      timeValue={period}
      onTimeChange={(value) =>
        setPeriod(value as 'day' | 'week' | 'month' | 'all')
      }
      onReset={resetFilters}
      qa="feed-filters"
    />
  );
  if (compact)
    return (
      <>
        <Button
          view={hasFilters ? 'outlined-info' : 'flat'}
          size="xl"
          aria-label={t('Фильтры ленты', 'Feed filters')}
          onClick={() => setOpen(true)}
        >
          <Icon data={Sliders} size={20} />
          {hasFilters && (
            <span className="feed-filter-dot" aria-hidden="true" />
          )}
        </Button>
        {open && (
          <ContentDialog
            title={t('Фильтры ленты', 'Feed filters')}
            onClose={() => setOpen(false)}
          >
            {controls}
            <Button
              size="xl"
              view="action"
              className="feed-filters__done"
              onClick={() => setOpen(false)}
            >
              {t('Показать записи', 'Show posts')}
            </Button>
          </ContentDialog>
        )}
      </>
    );
  return (
    <aside className="feed-sidebar" data-qa="feed-sidebar">
      <section className="feed-panel">
        <Text as="h2" variant="subheader-2">
          {t('Фильтры', 'Filters')}
        </Text>
        {controls}
      </section>
    </aside>
  );
};
