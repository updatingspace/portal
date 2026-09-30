import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../features/voting', async () => {
  const actual = await vi.importActual<typeof import('../../../features/voting')>('../../../features/voting');

  return {
    ...actual,
    usePolls: vi.fn(),
  };
});

import * as votingFeature from '../../../features/voting';
import type { PaginatedResponse, Poll } from '../../../features/voting/types';
import { renderWithProviders, screen, userEvent } from '../../../test/test-utils';
import { AnalyticsDashboardPage } from './AnalyticsDashboardPage';

const TEST_TIMEOUT_MS = 15000;

const buildPoll = (overrides: Partial<Poll>): Poll => ({
  id: 'poll-1',
  tenant_id: 'tenant-1',
  title: 'Closed Poll',
  description: null,
  status: 'closed',
  scope_type: 'TENANT',
  scope_id: 'tenant-1',
  visibility: 'public',
  template: null,
  allow_revoting: false,
  anonymous: false,
  results_visibility: 'always',
  settings: {},
  created_by: 'user-1',
  starts_at: null,
  ends_at: null,
  created_at: '2026-01-10T10:00:00Z',
  updated_at: '2026-01-10T10:00:00Z',
  ...overrides,
});

const buildResponse = (items: Poll[]): PaginatedResponse<Poll> => ({
  items,
  pagination: {
    total: items.length,
    limit: 20,
    offset: 0,
    has_next: false,
    has_prev: false,
  },
});

describe('AnalyticsDashboardPage integration', () => {
  it('lists completed polls without inventing aggregate metrics', async () => {
    vi.mocked(votingFeature.usePolls).mockReturnValue({
      data: buildResponse([
        buildPoll({ id: 'poll-1', title: 'Winter Cup', settings: { vote_count: 120 } }),
        buildPoll({ id: 'poll-2', title: 'Spring League', settings: { total_votes: 80 } }),
      ]),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof votingFeature.usePolls>);

    renderWithProviders(<AnalyticsDashboardPage />);

    expect(await screen.findByText('Итоги голосований')).toBeInTheDocument();
    expect(screen.queryByText('200')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', {name:'Результаты'})).toHaveLength(2);
    expect(screen.getByText('Winter Cup')).toBeInTheDocument();
    expect(screen.getByText('Spring League')).toBeInTheDocument();
  }, TEST_TIMEOUT_MS);

  it('renders empty state', async () => {
    vi.mocked(votingFeature.usePolls).mockReturnValue({
      data: buildResponse([]),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof votingFeature.usePolls>);

    renderWithProviders(<AnalyticsDashboardPage />);

    expect(await screen.findByText('Нет завершённых опросов')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'К голосованиям' })).toBeInTheDocument();
  }, TEST_TIMEOUT_MS);

  it('renders error state and supports retry action', async () => {
    const refetch = vi.fn();
    vi.mocked(votingFeature.usePolls).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('network'),
      refetch,
    } as ReturnType<typeof votingFeature.usePolls>);

    renderWithProviders(<AnalyticsDashboardPage />);

    expect(await screen.findByText('Не удалось загрузить итоги')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  }, TEST_TIMEOUT_MS);
});
