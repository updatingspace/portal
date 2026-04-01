/**
 * HomePage - Voting Catalog Page (Redesigned)
 * 
 * Main page displaying all voting sessions with improved UX:
 * - TanStack Query for data fetching with skeleton loading
 * - Unified API layer (supports legacy + modern votings)
 * - VotingList component with filters and sorting
 * - Breadcrumbs navigation
 * - WCAG 2.1 AA accessibility
 */

import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumbs, Button, Icon } from '@gravity-ui/uikit';
import { ArrowRotateRight } from '@gravity-ui/icons';

import { HomePageModalDisplay } from '../../components/HomePageModalDisplay';
import { useVotingSessions } from '../../features/voting/hooks/useVotingUnified';
import { VotingList } from '../../features/voting/components/VotingList';
import type { VotingSession } from '../../features/voting/unified';
import { HomeHero } from './components/HomeHero';
import { StagesSection } from './components/StagesSection';
import { voteStages } from './constants';

// ============================================================================
// HomePage Component
// ============================================================================

export const HomePageRedesigned: React.FC = () => {
  const navigate = useNavigate();
  
  // Fetch voting sessions via unified API
  const {
    data: votingSessions = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useVotingSessions({
    status: undefined, // Fetch all statuses
  });
  
  // Convert to VotingSession format for VotingList
  const votings: VotingSession[] = useMemo(() => {
    return votingSessions;
  }, [votingSessions]);
  
  // Separate active and archived votings for summary
  const activeVotings = useMemo(
    () => votings.filter((v) => v.status === 'active'),
    [votings],
  );
  
  const archivedVotings = useMemo(
    () => votings.filter((v) => v.status !== 'active'),
    [votings],
  );
  
  // Find next deadline for hero
  const nextDeadlineLabel = useMemo(() => {
    const withDeadline = activeVotings
      .filter((v) => v.ends_at)
      .sort((a, b) => {
        const aTime = new Date(a.ends_at!).getTime();
        const bTime = new Date(b.ends_at!).getTime();
        return aTime - bTime;
      });
    
    const next = withDeadline[0];
    if (!next?.ends_at) return 'Дедлайн уточняется';
    
    const deadline = new Date(next.ends_at);
    return deadline.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [activeVotings]);
  
  // Navigate to voting detail
  const handleVotingClick = useCallback((id: string) => {
    navigate(`/nominations?voting=${id}`);
  }, [navigate]);
  
  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);
  
  // Breadcrumbs
  const breadcrumbItems = [
    { text: 'Главная', href: '/' },
    { text: 'Голосования', href: '/votings' },
  ];
  
  return (
    <div className="page-section home-page">
      <HomePageModalDisplay />
      
      <div className="container">
        {/* Breadcrumbs */}
        <nav className="mb-3" aria-label="Навигация">
          <Breadcrumbs
            items={breadcrumbItems}
            firstDisplayedItemsCount={1}
            lastDisplayedItemsCount={1}
          />
        </nav>
        
        {/* Hero Section */}
        <HomeHero
          activeCount={activeVotings.length}
          archivedCount={archivedVotings.length}
          nextDeadlineLabel={nextDeadlineLabel}
        />
        
        {/* Stages Section */}
        <StagesSection stages={voteStages} />
        
        {/* Voting List Section */}
        <section className="home-section" aria-labelledby="active-votings-title">
          <div className="home-section-head">
            <div>
              <h2 id="active-votings-title" className="home-section-title">
                Все голосования
              </h2>
              <p className="home-section-subtitle">
                {activeVotings.length > 0
                  ? `${activeVotings.length} активных, ${archivedVotings.length} в архиве`
                  : 'Нет активных голосований'}
              </p>
            </div>
            
            <div className="home-section-actions">
              <Button
                view="flat-secondary"
                size="m"
                onClick={handleRefresh}
                disabled={isFetching}
                loading={isFetching}
              >
                <Icon data={ArrowRotateRight} size={16} />
                <span>Обновить</span>
              </Button>
            </div>
          </div>
          
          {/* Error State */}
          {isError && !votings.length && (
            <div className="status-block status-block-danger" role="alert">
              <div className="status-title">Не удалось загрузить голосования</div>
              <p className="text-muted mb-3">
                {error instanceof Error ? error.message : 'Попробуйте обновить страницу или зайти позже.'}
              </p>
              <Button view="outlined" onClick={handleRefresh}>
                Попробовать ещё раз
              </Button>
            </div>
          )}
          
          {/* Voting List with Filters */}
          {!isError && (
            <VotingList
              votings={votings}
              isLoading={isLoading}
              variant="medium"
              showFilters={true}
              showSorting={true}
              onVotingClick={handleVotingClick}
              emptyMessage="Активных голосований пока нет. Следите за обновлениями!"
            />
          )}
        </section>
      </div>
    </div>
  );
};

// ============================================================================
// Export
// ============================================================================

export default HomePageRedesigned;
