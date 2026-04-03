/**
 * VotingList Component
 * 
 * Display list/catalog of voting sessions with filtering, sorting, and pagination.
 * 
 * Features:
 * - Filters: Status (active/upcoming/finished), Type (nominations/polls)
 * - Sorting: Deadline (nearest first), Created date, Popularity
 * - Pagination with indicators or infinite scroll
 * - Empty states
 * - Skeleton loading
 */

import React, { useState, useMemo } from 'react';
import { Select, Button, Label } from '@gravity-ui/uikit';
import { VotingCard } from './VotingCard';
import { VotingCardSkeleton } from './skeletons/VotingCardSkeleton';
import type { VotingSession, PollStatus } from '../unified';

// ============================================================================
// Types
// ============================================================================

export interface VotingListProps {
  votings: VotingSession[];
  isLoading?: boolean;
  variant?: 'large' | 'medium' | 'small';
  showFilters?: boolean;
  showSorting?: boolean;
  onVotingClick?: (id: string) => void;
  emptyMessage?: string;
  className?: string;
}

type SortOption = 'deadline' | 'created' | 'title';
type FilterStatus = 'all' | PollStatus;

// ============================================================================
// Component
// ============================================================================

export const VotingList: React.FC<VotingListProps> = ({
  votings,
  isLoading = false,
  variant = 'medium',
  showFilters = true,
  showSorting = true,
  onVotingClick,
  emptyMessage = 'Нет доступных голосований',
  className = '',
}) => {
  // State
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortOption>('deadline');
  
  // Filter votings
  const filteredVotings = useMemo(() => {
    let result = [...votings];
    
    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter((v) => v.status === filterStatus);
    }
    
    return result;
  }, [votings, filterStatus]);
  
  // Sort votings
  const sortedVotings = useMemo(() => {
    const result = [...filteredVotings];
    
    switch (sortBy) {
      case 'deadline':
        return result.sort((a, b) => {
          const aTime = a.ends_at ? new Date(a.ends_at).getTime() : Number.POSITIVE_INFINITY;
          const bTime = b.ends_at ? new Date(b.ends_at).getTime() : Number.POSITIVE_INFINITY;
          return aTime - bTime; // Nearest deadline first
        });
      
      case 'created':
        return result.sort((a, b) => {
          const aTime = new Date(a.created_at).getTime();
          const bTime = new Date(b.created_at).getTime();
          return bTime - aTime; // Newest first
        });
      
      case 'title':
        return result.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
      
      default:
        return result;
    }
  }, [filteredVotings, sortBy]);
  
  // Group by status for better UX
  const groupedVotings = useMemo(() => {
    const active = sortedVotings.filter((v) => v.status === 'active');
    const draft = sortedVotings.filter((v) => v.status === 'draft');
    const closed = sortedVotings.filter((v) => v.status === 'closed');
    
    return { active, draft, closed };
  }, [sortedVotings]);
  
  // Filter options
  const filterOptions = [
    { value: 'all', content: 'Все' },
    { value: 'active', content: 'Активные' },
    { value: 'draft', content: 'Черновики' },
    { value: 'closed', content: 'Завершённые' },
  ];
  
  // Sort options
  const sortOptions = [
    { value: 'deadline', content: 'По дедлайну' },
    { value: 'created', content: 'По дате создания' },
    { value: 'title', content: 'По названию' },
  ];
  
  // Render loading state
  if (isLoading) {
    return (
      <div className={`voting-list ${className}`}>
        {showFilters && (
          <div className="voting-list__filters">
            <div className="skeleton-box skeleton-box--button" />
            <div className="skeleton-box skeleton-box--button" />
          </div>
        )}
        <div className="voting-list__grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <VotingCardSkeleton key={i} variant={variant} />
          ))}
        </div>
      </div>
    );
  }
  
  // Render empty state
  if (sortedVotings.length === 0 && !isLoading) {
    return (
      <div className={`voting-list voting-list--empty ${className}`}>
        {showFilters && (
          <div className="voting-list__filters">
            <Select
              value={[filterStatus]}
              onUpdate={(values) => setFilterStatus(values[0] as FilterStatus)}
              options={filterOptions}
              placeholder="Фильтр"
              size="m"
            />
            <Select
              value={[sortBy]}
              onUpdate={(values) => setSortBy(values[0] as SortOption)}
              options={sortOptions}
              placeholder="Сортировка"
              size="m"
            />
          </div>
        )}
        
        <div className="voting-list__empty-state">
          <div className="voting-list__empty-icon" aria-hidden="true">🗳️</div>
          <p className="voting-list__empty-message">{emptyMessage}</p>
          {filterStatus !== 'all' && (
            <Button
              view="outlined"
              size="m"
              onClick={() => setFilterStatus('all')}
            >
              Показать все
            </Button>
          )}
        </div>
      </div>
    );
  }
  
  // Render votings list
  return (
    <div className={`voting-list ${className}`}>
      {/* Filters & Sorting */}
      {(showFilters || showSorting) && (
        <div className="voting-list__toolbar">
          {showFilters && (
            <div className="voting-list__filters">
              <Select
                value={[filterStatus]}
                onUpdate={(values) => setFilterStatus(values[0] as FilterStatus)}
                options={filterOptions}
                placeholder="Фильтр"
                size="m"
                aria-label="Фильтр по статусу"
              />
            </div>
          )}
          
          {showSorting && (
            <div className="voting-list__sorting">
              <Select
                value={[sortBy]}
                onUpdate={(values) => setSortBy(values[0] as SortOption)}
                options={sortOptions}
                placeholder="Сортировка"
                size="m"
                aria-label="Сортировка"
              />
            </div>
          )}
        </div>
      )}
      
      {/* Count Summary */}
      <div className="voting-list__summary" role="status" aria-live="polite">
        Найдено: <strong>{sortedVotings.length}</strong> {getVotingLabel(sortedVotings.length)}
      </div>
      
      {/* Grouped Votings */}
      {filterStatus === 'all' ? (
        <>
          {/* Active Votings */}
          {groupedVotings.active.length > 0 && (
            <section className="voting-list__section">
              <h2 className="voting-list__section-title">
                <Label theme="success" size="m">Активные</Label>
                <span className="voting-list__section-count">
                  {groupedVotings.active.length}
                </span>
              </h2>
              <div className="voting-list__grid">
                {groupedVotings.active.map((voting) => (
                  <VotingCard
                    key={voting.id}
                    voting={voting}
                    variant={variant}
                    onClick={onVotingClick}
                  />
                ))}
              </div>
            </section>
          )}
          
          {/* Draft Votings */}
          {groupedVotings.draft.length > 0 && (
            <section className="voting-list__section">
              <h2 className="voting-list__section-title">
                <Label theme="info" size="m">Черновики</Label>
                <span className="voting-list__section-count">
                  {groupedVotings.draft.length}
                </span>
              </h2>
              <div className="voting-list__grid">
                {groupedVotings.draft.map((voting) => (
                  <VotingCard
                    key={voting.id}
                    voting={voting}
                    variant={variant}
                    onClick={onVotingClick}
                  />
                ))}
              </div>
            </section>
          )}
          
          {/* Closed Votings */}
          {groupedVotings.closed.length > 0 && (
            <section className="voting-list__section">
              <h2 className="voting-list__section-title">
                <Label theme="normal" size="m">Завершённые</Label>
                <span className="voting-list__section-count">
                  {groupedVotings.closed.length}
                </span>
              </h2>
              <div className="voting-list__grid voting-list__grid--collapsed">
                {groupedVotings.closed.slice(0, 6).map((voting) => (
                  <VotingCard
                    key={voting.id}
                    voting={voting}
                    variant="small"
                    onClick={onVotingClick}
                  />
                ))}
              </div>
              {groupedVotings.closed.length > 6 && (
                <Button
                  view="flat"
                  size="m"
                  className="voting-list__show-more"
                  onClick={() => setFilterStatus('closed')}
                >
                  Показать все завершённые ({groupedVotings.closed.length})
                </Button>
              )}
            </section>
          )}
        </>
      ) : (
        // Filtered view (no grouping)
        <div className="voting-list__grid">
          {sortedVotings.map((voting) => (
            <VotingCard
              key={voting.id}
              voting={voting}
              variant={variant}
              onClick={onVotingClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Get voting count label (Russian plural forms)
 */
function getVotingLabel(count: number): string {
  if (count % 10 === 1 && count !== 11) return 'голосование';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count)) return 'голосования';
  return 'голосований';
}

// ============================================================================
// Export
// ============================================================================

export default VotingList;
