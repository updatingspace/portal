/**
 * VotingPage - Voting Session Detail Page (Redesigned)
 * 
 * Displays a single voting session with its nominations:
 * - TanStack Query for data fetching with skeleton loading
 * - Unified API layer (supports legacy + modern votings)
 * - Voting metadata section (deadline, status, description)
 * - NominationCard list with visual hierarchy
 * - Breadcrumbs navigation
 * - WCAG 2.1 AA accessibility
 */

import React, { useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Breadcrumbs, Button, Card, Icon, Label, Progress, Skeleton } from '@gravity-ui/uikit';
import { ArrowLeft, ArrowRotateRight, Clock } from '@gravity-ui/icons';

import { useVotingSession } from '../../features/voting/hooks/useVotingUnified';
import { VotingAlerts, createVotingAlerts } from '../../features/voting/components/VotingAlerts';
import type { VotingAlert } from '../../features/voting/components/VotingAlerts';

// ============================================================================
// Types
// ============================================================================

type VoteStatus = 'active' | 'paused' | 'expired';

// ============================================================================
// Utility Functions
// ============================================================================

const formatDeadline = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  
  return parsed.toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const getTimeRemaining = (endsAt?: string | null): string | null => {
  if (!endsAt) return null;
  
  const deadline = new Date(endsAt);
  if (Number.isNaN(deadline.getTime())) return null;
  
  const now = Date.now();
  const remaining = deadline.getTime() - now;
  
  if (remaining <= 0) return 'Завершено';
  
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days} дн. ${hours} ч.`;
  if (hours > 0) return `${hours} ч.`;
  
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  return `${minutes} мин.`;
};

const getStatusLabel = (status: VoteStatus): string => {
  switch (status) {
    case 'active':
      return 'Активно';
    case 'paused':
      return 'На паузе';
    case 'expired':
      return 'Завершено';
    default:
      return 'Неизвестно';
  }
};

const getStatusTheme = (status: VoteStatus): 'success' | 'warning' | 'info' => {
  switch (status) {
    case 'active':
      return 'success';
    case 'paused':
      return 'warning';
    case 'expired':
      return 'info';
    default:
      return 'info';
  }
};

// ============================================================================
// VotingPage Component
// ============================================================================

export const VotingPageRedesigned: React.FC = () => {
  const { votingId } = useParams<{ votingId: string }>();
  const navigate = useNavigate();
  
  // Fetch voting session with nominations
  const {
    data: votingSession,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useVotingSession(votingId ?? '', {
    enabled: Boolean(votingId),
  });
  
  // Determine voting status
  const votingStatus: VoteStatus = useMemo(() => {
    if (!votingSession) return 'active';
    
    const deadline = votingSession.ends_at ? new Date(votingSession.ends_at) : null;
    if (deadline && deadline.getTime() < Date.now()) {
      return 'expired';
    }
    
    return votingSession.status === 'active' ? 'active' : 'paused';
  }, [votingSession]);
  
  // Get nominations (from questions or legacy nominations)
  const nominations = useMemo(() => {
    if (!votingSession) return [];
    
    // For legacy votings, nominations might be in a different structure
    // This adapts to both legacy and modern API responses
    if ('nominations' in votingSession && Array.isArray((votingSession as any).nominations)) {
      return (votingSession as any).nominations;
    }
    
    // For modern polls, use questions
    if (votingSession.questions) {
      return votingSession.questions;
    }
    
    return [];
  }, [votingSession]);
  
  // Alerts
  const alerts = useMemo<VotingAlert[]>(() => {
    const result: VotingAlert[] = [];
    
    if (votingStatus === 'expired') {
      result.push(createVotingAlerts.votingClosed(() => {
        // Navigate to results
      }));
    }
    
    return result;
  }, [votingStatus]);
  
  // Breadcrumbs
  const breadcrumbItems = useMemo(() => [
    { text: 'Главная', href: '/' },
    { text: 'Голосования', href: '/votings' },
    { text: votingSession?.title ?? 'Голосование', href: '#' },
  ], [votingSession?.title]);
  
  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);
  
  // Handle nomination click
  const handleNominationClick = useCallback((nominationId: string) => {
    navigate(`/nominations/${nominationId}`);
  }, [navigate]);
  
  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className="page-section voting-page">
        <div className="container">
          <div className="row">
            <section className="col-12 col-lg-10 mx-auto">
              {/* Skeleton Breadcrumbs */}
              <div className="mb-3">
                <Skeleton style={{ width: 200, height: 20 }} />
              </div>
              
              {/* Skeleton Header */}
              <div className="mb-4">
                <Skeleton style={{ width: '60%', height: 32, marginBottom: 12 }} />
                <Skeleton style={{ width: '80%', height: 20, marginBottom: 8 }} />
                <Skeleton style={{ width: 150, height: 16 }} />
              </div>
              
              {/* Skeleton Grid */}
              <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 g-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div className="col" key={i}>
                    <Skeleton style={{ width: '100%', height: 80, borderRadius: 8 }} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (isError || (!isLoading && !votingSession)) {
    return (
      <div className="page-section voting-page">
        <div className="container">
          <div className="row">
            <section className="col-12 col-lg-10 mx-auto">
              <div className="status-block status-block-danger" role="alert">
                <div className="status-title">Не удалось загрузить голосование</div>
                <p className="text-muted mb-3">
                  {error instanceof Error ? error.message : 'Проверьте ссылку или вернитесь к списку.'}
                </p>
                <div className="d-flex gap-2">
                  <Button view="outlined" onClick={handleRefresh}>
                    Попробовать ещё раз
                  </Button>
                  <Button view="flat" onClick={handleBack}>
                    <Icon data={ArrowLeft} size={16} />
                    <span>Назад к списку</span>
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }
  
  const deadlineLabel = formatDeadline(votingSession?.ends_at);
  const timeRemaining = getTimeRemaining(votingSession?.ends_at);
  
  return (
    <div className="page-section voting-page">
      <div className="container">
        <div className="row">
          <section className="col-12 col-lg-10 mx-auto">
            {/* Breadcrumbs */}
            <nav className="mb-3" aria-label="Навигация">
              <Breadcrumbs
                items={breadcrumbItems}
                firstDisplayedItemsCount={1}
                lastDisplayedItemsCount={2}
              />
            </nav>
            
            {/* Back Button */}
            <div className="mb-3">
              <Button view="flat" size="m" onClick={handleBack}>
                <Icon data={ArrowLeft} size={16} />
                <span>Назад к голосованиям</span>
              </Button>
            </div>
            
            {/* Alerts */}
            <VotingAlerts alerts={alerts} />
            
            {/* Header */}
            <header className="voting-page__header mb-4">
              <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
                <div>
                  <h1 className="page-title mb-2">
                    {votingSession?.title ?? `Голосование ${votingId}`}
                  </h1>
                  <p className="text-muted mb-2">
                    {votingSession?.description ?? 'Выберите номинацию и проставьте голос.'}
                  </p>
                </div>
                
                <div className="d-flex align-items-center gap-2">
                  <Label theme={getStatusTheme(votingStatus)} size="m">
                    {getStatusLabel(votingStatus)}
                  </Label>
                  
                  <Button
                    view="flat-secondary"
                    size="s"
                    onClick={handleRefresh}
                    loading={isFetching}
                    disabled={isFetching}
                  >
                    <Icon data={ArrowRotateRight} size={16} />
                  </Button>
                </div>
              </div>
              
              {/* Metadata Card */}
              {(deadlineLabel || timeRemaining) && (
                <Card className="voting-page__meta-card mt-3">
                  <div className="d-flex align-items-center gap-3 p-3">
                    <Icon data={Clock} size={24} className="text-muted" />
                    <div>
                      {deadlineLabel && (
                        <div className="small text-muted">Дедлайн: {deadlineLabel}</div>
                      )}
                      {timeRemaining && votingStatus === 'active' && (
                        <div className="fw-medium">Осталось: {timeRemaining}</div>
                      )}
                    </div>
                  </div>
                  
                  {votingStatus === 'active' && votingSession?.ends_at && (
                    <div className="px-3 pb-3">
                      <Progress
                        value={calculateProgress(votingSession.created_at, votingSession.ends_at)}
                        theme="success"
                        size="s"
                      />
                    </div>
                  )}
                </Card>
              )}
            </header>
            
            {/* Nominations Grid */}
            {nominations.length > 0 ? (
              <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 g-3">
                {nominations.map((nomination: any) => (
                  <div className="col" key={nomination.id}>
                    <button
                      type="button"
                      className="nomination-tile"
                      onClick={() => handleNominationClick(nomination.id)}
                      aria-label={`Открыть номинацию: ${nomination.title}`}
                    >
                      <div className="nomination-tile-inner">
                        {nomination.title}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="status-block status-block-warning">
                <div className="status-title">Номинаций пока нет</div>
                <p className="text-muted mb-0">
                  Возможно голосование ещё не настроено или не опубликовано.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

/**
 * Calculate progress percentage between start and end dates
 */
function calculateProgress(startAt: string, endAt: string): number {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const now = Date.now();
  
  if (now >= end) return 100;
  if (now <= start) return 0;
  
  const total = end - start;
  const elapsed = now - start;
  
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

// ============================================================================
// Export
// ============================================================================

export default VotingPageRedesigned;
