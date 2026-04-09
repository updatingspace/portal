import React from 'react';

import { ApiError } from '../api/client';
import { Routes, Route, useParams } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';

vi.mock('@gravity-ui/uikit', async () => {
  const actual = await vi.importActual<typeof import('@gravity-ui/uikit')>('@gravity-ui/uikit');

  const BreadcrumbsStub = ({ children }: { children?: React.ReactNode }) => <nav>{children}</nav>;
  BreadcrumbsStub.Item = ({ children, href }: { children?: React.ReactNode; href?: string }) => <a href={href}>{children}</a>;

  return {
    ...actual,
    Breadcrumbs: BreadcrumbsStub,
  };
});

vi.mock('@/features/voting/hooks/useVotingUnified', async () => {
  const actual = await vi.importActual<typeof import('@/features/voting/hooks/useVotingUnified')>(
    '@/features/voting/hooks/useVotingUnified',
  );

  return {
    ...actual,
    useVotingSession: vi.fn(),
  };
});

import { renderWithProviders, screen, userEvent } from '../test/test-utils';
import { VotingPage } from './VotingPage';
import { withMockedDate } from '../test/time';
import * as votingUnifiedHooks from '@/features/voting/hooks/useVotingUnified';

const NOMINATION_TITLE = 'Лучшая графика';
const SECOND_NOMINATION_TITLE = 'Лучший геймплей';
const ACTIVE_STATUS_LABEL = 'Активно';
const RETRY_BUTTON_LABEL = 'Попробовать ещё раз';
const VOTING_ROUTE = '/votings/vote-active';
const VOTING_ROUTE_PATH = '/votings/:votingId';

const refetchVotingSession = vi.fn();

const votingSession = {
  id: 'vote-active',
  title: 'Витринное голосование',
  description: 'Тестовое голосование для проверки навигации.',
  status: 'active',
  created_at: '2025-02-01T12:00:00Z',
  ends_at: '2030-02-10T12:00:00Z',
  questions: [
    { id: 'nom-1', title: NOMINATION_TITLE },
    { id: 'nom-2', title: SECOND_NOMINATION_TITLE },
  ],
};

const NominationProbe: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return <div>{`nomination:${id}`}</div>;
};

function renderVotingPage() {
  renderWithProviders(
    <Routes>
      <Route path={VOTING_ROUTE_PATH} element={<VotingPage />} />
      <Route path="/nominations/:id" element={<NominationProbe />} />
    </Routes>,
    { route: VOTING_ROUTE },
  );
}

describe('VotingPage integration', () => {
  test('shows loading indicator before nominations are rendered', withMockedDate(async () => {
    vi.mocked(votingUnifiedHooks.useVotingSession).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: refetchVotingSession,
      isFetching: false,
    } as ReturnType<typeof votingUnifiedHooks.useVotingSession>);

    renderVotingPage();

    expect(document.querySelectorAll('.g-skeleton').length).toBeGreaterThan(0);
  }));

  test('renders nominations and first nomination link after loading', withMockedDate(async () => {
    vi.mocked(votingUnifiedHooks.useVotingSession).mockReturnValue({
      data: votingSession,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchVotingSession,
      isFetching: false,
    } as ReturnType<typeof votingUnifiedHooks.useVotingSession>);

    renderVotingPage();

    expect(await screen.findByRole('heading', { level: 1, name: votingSession.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Открыть номинацию: ${NOMINATION_TITLE}` })).toBeInTheDocument();
    expect(screen.getByText(SECOND_NOMINATION_TITLE)).toBeInTheDocument();
    expect(screen.getByText(ACTIVE_STATUS_LABEL, { exact: false })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: `Открыть номинацию: ${NOMINATION_TITLE}` }));
    expect(await screen.findByText('nomination:nom-1')).toBeInTheDocument();
  }));

  test('retries nominations fetch when user clicks retry', withMockedDate(async () => {
    refetchVotingSession.mockClear();
    vi.mocked(votingUnifiedHooks.useVotingSession).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiError('fail', { kind: 'server', status: 500 }),
      refetch: refetchVotingSession,
      isFetching: false,
    } as ReturnType<typeof votingUnifiedHooks.useVotingSession>);

    renderVotingPage();

    const retryButton = await screen.findByRole('button', { name: RETRY_BUTTON_LABEL });
    expect(retryButton).toBeEnabled();
    await userEvent.click(retryButton);

    expect(refetchVotingSession).toHaveBeenCalledTimes(1);
  }));
});
