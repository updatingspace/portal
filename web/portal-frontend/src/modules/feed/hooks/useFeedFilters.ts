import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type SourceFilter = 'all' | 'news' | 'voting' | 'events';
export type TimeFilter = 'day' | 'week' | 'month' | 'all';
export type SortFilter = 'best' | 'recent';

const isSource = (value: string | null): value is SourceFilter =>
  value === 'all' || value === 'news' || value === 'voting' || value === 'events';
const isTime = (value: string | null): value is TimeFilter =>
  value === 'day' || value === 'week' || value === 'month' || value === 'all';
const isSort = (value: string | null): value is SortFilter => value === 'best' || value === 'recent';

const getSourceTypes = (source: SourceFilter) => {
  if (source === 'news') return ['news.posted', 'post.created'];
  if (source === 'voting') return ['vote.cast'];
  if (source === 'events') return ['event.created', 'event.rsvp.changed'];
  return [];
};

const getTimeRange = (value: TimeFilter) => {
  if (value === 'all') return { from: null, to: null };
  const now = new Date();
  const base = new Date(now.getTime());
  if (value === 'day') base.setDate(now.getDate() - 1);
  if (value === 'week') base.setDate(now.getDate() - 7);
  if (value === 'month') base.setDate(now.getDate() - 30);
  return { from: base, to: now };
};

export function useFeedFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const source = isSource(searchParams.get('source')) ? (searchParams.get('source') as SourceFilter) : 'all';
  const sort = isSort(searchParams.get('sort')) ? (searchParams.get('sort') as SortFilter) : 'best';
  const period = isTime(searchParams.get('period')) ? (searchParams.get('period') as TimeFilter) : 'week';

  const setFilter = useCallback(
    (key: 'source' | 'sort' | 'period', value: string) => {
      const next = new URLSearchParams(searchParams);
      next.set(key, value);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const resetFilters = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.set('source', 'all');
    next.set('sort', 'best');
    next.set('period', 'week');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const typesParam = useMemo(() => {
    const sourceTypes = getSourceTypes(source);
    return sourceTypes.length > 0 ? sourceTypes.join(',') : undefined;
  }, [source]);

  const { from, to } = useMemo(() => getTimeRange(period), [period]);
  const fromParam = from ? new Date(from).toISOString() : undefined;
  const toParam = to ? new Date(to).toISOString() : undefined;

  return {
    source,
    sort,
    period,
    setSource: (value: SourceFilter) => setFilter('source', value),
    setSort: (value: SortFilter) => setFilter('sort', value),
    setPeriod: (value: TimeFilter) => setFilter('period', value),
    resetFilters,
    typesParam,
    fromParam,
    toParam,
    hasActiveFilters: source !== 'all' || sort !== 'best' || period !== 'week',
  };
}
