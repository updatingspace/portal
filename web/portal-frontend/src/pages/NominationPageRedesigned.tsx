/**
 * NominationPage - Nomination Detail Page (Redesigned)
 * 
 * Displays a single nomination with voting options:
 * - TanStack Query with optimistic updates
 * - Unified API layer (supports legacy + modern votings)
 * - NominationCard components with visual feedback
 * - Progressive disclosure (compact → expanded → modal)
 * - VotingAlerts for contextual feedback
 * - Breadcrumbs navigation
 * - WCAG 2.1 AA accessibility
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Breadcrumbs, Button, Card, Icon, Label, Skeleton } from '@gravity-ui/uikit';
import { ArrowLeft, ArrowRotateRight, Check, Eye, EyeSlash } from '@gravity-ui/icons';

import { useNomination, useCastVoteUnified } from '@/features/voting/hooks/useVotingUnified';
import { NominationCard, type VotingMode } from '@/features/voting/components/NominationCard';
import { VoteButton } from '@/features/voting/components/VoteButton';
import { VotingAlerts, createVotingAlerts, type VotingAlert } from '@/features/voting/components/VotingAlerts';
import { toaster } from '@/toaster';

// ============================================================================
// Types
// ============================================================================

interface Option {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
}

// ============================================================================
// NominationPage Component
// ============================================================================

export const NominationPageRedesigned: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Local state
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showVoteCounts, setShowVoteCounts] = useState(false);
  const [alerts, setAlerts] = useState<VotingAlert[]>([]);
  
  // Fetch nomination detail
  const {
    data: nomination,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useNomination(id ?? '', {
    enabled: Boolean(id),
  });
  
  // Cast vote mutation with optimistic updates
  const castVoteMutation = useCastVoteUnified();
  
  // Extract options from nomination
  const options: Option[] = useMemo(() => {
    if (!nomination) return [];
    return (nomination as any).options ?? [];
  }, [nomination]);
  
  // Vote counts
  const voteCounts: Record<string, number> = useMemo(() => {
    if (!nomination) return {};
    return (nomination as any).counts ?? {};
  }, [nomination]);
  
  // Total votes
  const totalVotes = useMemo(() => {
    return Object.values(voteCounts).reduce((sum, count) => sum + count, 0);
  }, [voteCounts]);
  
  // User's current vote
  const userVote = (nomination as any)?.userVote ?? null;
  
  // Voting state
  const isVotingClosed = (nomination as any)?.isVotingOpen === false;
  const needsTelegramLink = (nomination as any)?.requiresTelegramLink ?? false;
  const canVoteNow = ((nomination as any)?.canVote ?? false) && !needsTelegramLink;
  const disableVoting = isVotingClosed || !canVoteNow;
  
  // Voting mode (single choice for legacy nominations)
  const votingMode: VotingMode = 'single';
  
  // Deadline
  const deadlineLabel = useMemo(() => {
    const deadline = (nomination as any)?.votingDeadline;
    if (!deadline) return null;
    
    const parsed = new Date(deadline);
    if (Number.isNaN(parsed.getTime())) return null;
    
    return parsed.toLocaleString('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [nomination]);
  
  // Initialize selected option from user vote
  useEffect(() => {
    if (userVote && options.some((opt) => opt.id === userVote)) {
      setSelectedOptionId(userVote);
    } else if (options.length > 0 && !selectedOptionId) {
      // Don't auto-select first option - let user choose
    }
  }, [userVote, options, selectedOptionId]);
  
  // Update alerts based on voting state
  useEffect(() => {
    const newAlerts: VotingAlert[] = [];
    
    if (isVotingClosed) {
      newAlerts.push(createVotingAlerts.votingClosed());
    } else if (needsTelegramLink) {
      newAlerts.push(createVotingAlerts.telegramRequired(() => {
        navigate('/profile/settings');
      }));
    } else if (!canVoteNow && !isVotingClosed) {
      newAlerts.push(createVotingAlerts.authRequired(() => {
        navigate('/login');
      }));
    }
    
    setAlerts(newAlerts);
  }, [isVotingClosed, needsTelegramLink, canVoteNow, navigate]);
  
  // Handle option select
  const handleOptionSelect = useCallback((optionId: string) => {
    setSelectedOptionId(optionId);
  }, []);
  
  // Handle option deselect
  const handleOptionDeselect = useCallback(() => {
    // In single-choice mode, clicking selected option doesn't deselect
    // User must choose another option
  }, []);
  
  // Handle vote submission
  const handleVote = useCallback(async () => {
    if (!id || !selectedOptionId || disableVoting) return;
    
    try {
      await castVoteMutation.mutateAsync({
        pollId: (nomination as any)?.voting?.id ?? '',
        nominationId: id,
        optionId: selectedOptionId,
      });
      
      // Success feedback
      setAlerts((prev) => [
        ...prev.filter((a) => a.id !== 'vote-success'),
        createVotingAlerts.voteSuccess(),
      ]);
      
      toaster.add({
        name: `vote-${Date.now()}`,
        theme: 'success',
        title: 'Голос учтён',
        content: 'Спасибо! Ваш выбор сохранён.',
        autoHiding: 4000,
      });
    } catch (err) {
      // Error feedback
      setAlerts((prev) => [
        ...prev.filter((a) => a.id !== 'vote-error'),
        createVotingAlerts.voteError(
          err instanceof Error ? err.message : undefined,
          () => handleVote(),
        ),
      ]);
    }
  }, [id, selectedOptionId, disableVoting, castVoteMutation, nomination]);
  
  // Handle alert dismiss
  const handleAlertDismiss = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);
  
  // Handle back navigation
  const handleBack = useCallback(() => {
    const votingId = (nomination as any)?.voting?.id;
    if (votingId) {
      navigate(`/votings/${votingId}`);
    } else {
      navigate('/');
    }
  }, [navigate, nomination]);
  
  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);
  
  // Breadcrumbs
  const breadcrumbItems = useMemo(() => {
    const votingTitle = (nomination as any)?.voting?.title ?? 'Голосование';
    const nominationTitle = nomination?.title ?? 'Номинация';
    
    return [
      { text: 'Главная', href: '/' },
      { text: votingTitle, href: `/votings/${(nomination as any)?.voting?.id ?? ''}` },
      { text: nominationTitle, href: '#' },
    ];
  }, [nomination]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className="page-section nomination-page">
        <div className="container">
          <div className="row">
            <section className="col-12 col-lg-10 mx-auto">
              {/* Skeleton Breadcrumbs */}
              <div className="mb-3">
                <Skeleton style={{ width: 250, height: 20 }} />
              </div>
              
              {/* Skeleton Header */}
              <div className="mb-4">
                <Skeleton style={{ width: '50%', height: 32, marginBottom: 12 }} />
                <Skeleton style={{ width: '70%', height: 20 }} />
              </div>
              
              {/* Skeleton Options */}
              <div className="d-flex flex-column gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} style={{ width: '100%', height: 100, borderRadius: 12 }} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (isError || (!isLoading && !nomination)) {
    return (
      <div className="page-section nomination-page">
        <div className="container">
          <div className="row">
            <section className="col-12 col-lg-10 mx-auto">
              <div className="status-block status-block-danger" role="alert">
                <div className="status-title">Номинация не найдена</div>
                <p className="text-muted mb-3">
                  {error instanceof Error ? error.message : 'Проверьте ссылку или вернитесь к списку.'}
                </p>
                <div className="d-flex gap-2 flex-wrap">
                  <Button view="outlined" onClick={handleRefresh}>
                    Попробовать ещё раз
                  </Button>
                  <Link to="/" className="btn btn-link">
                    ← Назад к голосованиям
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }
  
  const hasVoteCounts = Object.keys(voteCounts).length > 0;
  const isVoting = castVoteMutation.isPending;
  const hasUserVoted = Boolean(userVote);
  const canSubmit = selectedOptionId && !disableVoting && selectedOptionId !== userVote;
  
  return (
    <div className="page-section nomination-page">
      <div className="container">
        <div className="row">
          <section className="col-12 col-lg-10 mx-auto">
            {/* Breadcrumbs */}
            <nav className="mb-3" aria-label="Навигация">
              <Breadcrumbs>
                {breadcrumbItems.map((item, index) => (
                  <Breadcrumbs.Item key={`${item.text}-${index}`} href={item.href}>
                    {item.text}
                  </Breadcrumbs.Item>
                ))}
              </Breadcrumbs>
            </nav>
            
            {/* Back Button */}
            <div className="mb-3">
              <Button view="flat" size="m" onClick={handleBack}>
                <Icon data={ArrowLeft} size={16} />
                <span>Назад</span>
              </Button>
            </div>
            
            {/* Alerts */}
            <VotingAlerts alerts={alerts} onDismiss={handleAlertDismiss} />
            
            {/* Header */}
            <header className="nomination-page__header mb-4">
              <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
                <div>
                  <h1 className="page-title mb-2">
                    {nomination?.title ?? 'Номинация'}
                  </h1>
                  {nomination?.description && (
                    <p className="text-muted mb-2">{nomination.description}</p>
                  )}
                  {deadlineLabel && (
                    <p className="small text-muted mb-0">
                      Дедлайн: {deadlineLabel}
                    </p>
                  )}
                </div>
                
                <div className="d-flex align-items-center gap-2">
                  {isVotingClosed ? (
                    <Label theme="warning" size="m">Завершено</Label>
                  ) : hasUserVoted ? (
                    <Label theme="success" size="m">
                      <Icon data={Check} size={14} />
                      <span className="ms-1">Проголосовано</span>
                    </Label>
                  ) : (
                    <Label theme="info" size="m">Голосование открыто</Label>
                  )}
                  
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
            </header>
            
            {/* Vote Counts Toggle */}
            {hasVoteCounts && (
              <div className="mb-3">
                <Button
                  view="flat"
                  size="s"
                  onClick={() => setShowVoteCounts(!showVoteCounts)}
                >
                  <Icon data={showVoteCounts ? EyeSlash : Eye} size={16} />
                  <span>{showVoteCounts ? 'Скрыть результаты' : 'Показать результаты'}</span>
                </Button>
              </div>
            )}
            
            {/* Options List */}
            <div className="nomination-page__options mb-4" role="group" aria-label="Варианты голосования">
              {options.length > 0 ? (
                <div className="d-flex flex-column gap-3">
                  {options.map((option) => (
                    <NominationCard
                      key={option.id}
                      nomination={{
                        id: option.id,
                        poll_id: (nomination as any)?.voting?.id ?? '',
                        title: option.title,
                        description: option.description ?? null,
                        kind: 'custom',
                        sort_order: 0,
                        max_votes: 1,
                        is_required: false,
                        config: {},
                        image_url: option.image_url,
                        vote_count: voteCounts[option.id],
                      }}
                      mode={votingMode}
                      isSelected={selectedOptionId === option.id}
                      isVoted={userVote === option.id}
                      isDisabled={disableVoting}
                      showVoteCount={showVoteCounts}
                      totalVotes={totalVotes}
                      onSelect={handleOptionSelect}
                      onDeselect={handleOptionDeselect}
                    />
                  ))}
                </div>
              ) : (
                <div className="status-block status-block-warning">
                  <div className="status-title">Вариантов для голосования нет</div>
                  <p className="text-muted mb-0">
                    Номинация пока не содержит опций.
                  </p>
                </div>
              )}
            </div>
            
            {/* Submit Vote Button */}
            {options.length > 0 && !isVotingClosed && (
              <Card className="nomination-page__action-card p-4">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                  <div>
                    {selectedOptionId ? (
                      <p className="mb-0">
                        Выбрано: <strong>{options.find((o) => o.id === selectedOptionId)?.title}</strong>
                      </p>
                    ) : (
                      <p className="mb-0 text-muted">Выберите вариант для голосования</p>
                    )}
                  </div>
                  
                  <Button
                    view="action"
                    size="l"
                    disabled={!canSubmit || isVoting}
                    loading={isVoting}
                    onClick={handleVote}
                  >
                    {hasUserVoted ? 'Изменить голос' : 'Проголосовать'}
                  </Button>
                </div>
              </Card>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Export
// ============================================================================

export default NominationPageRedesigned;
