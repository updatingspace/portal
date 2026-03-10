import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../features/voting', async () => {
  const actual = await vi.importActual<typeof import('../../../features/voting')>('../../../features/voting');

  return {
    ...actual,
    usePolls: vi.fn(),
    isRateLimitError: vi.fn(),
  };
});

import * as votingFeature from '../../../features/voting';
import type { Poll, PaginatedResponse } from '../../../features/voting/types';
import { PollsPage } from './PollsPage';
import { renderWithProviders, screen, userEvent } from '../../../test/test-utils';

const TEST_TIMEOUT_MS = 15000;

const buildPoll = (overrides: Partial<Poll>): Poll => ({
  id: 'poll-1',
  tenant_id: 'tenant-1',
  title: 'Опрос',
  description: 'Описание',
  status: 'active',
  scope_type: 'TENANT',
  scope_id: 'tenant-1',
  visibility: 'public',
  template: null,
  allow_revoting: true,
  anonymous: false,
  results_visibility: 'after_closed',
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
    limit: 12,
    offset: 0,
    has_next: false,
    has_prev: false,
  },
});

const adminUser = {
  id: 'user-admin',
  username: 'admin',
  email: 'admin@example.com',
  isSuperuser: true,
  isStaff: true,
  displayName: 'Admin',
  tenant: { id: 'tenant-1', slug: 'aef' },
  capabilities: ['voting.votings.admin'],
  roles: [],
} as const;

const readerUser = {
  ...adminUser,
  isSuperuser: false,
  isStaff: false,
  capabilities: ['voting.votings.read'],
} as const;

describe('PollsPage integration', () => {
  it('renders loading state', () => {
    vi.mocked(votingFeature.usePolls).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as ReturnType<typeof votingFeature.usePolls>);

    renderWithProviders(<PollsPage />, { authUser: adminUser });

    expect(screen.getByText('Загружаем голосования…')).toBeInTheDocument();
  }, TEST_TIMEOUT_MS);

  it('filters list by search and status', async () => {
    const paramsSpy = vi.fn();

    vi.mocked(votingFeature.usePolls).mockImplementation((params) => {
      paramsSpy(params);
      return {
        data: buildResponse([
          buildPoll({ id: 'poll-1', title: 'Alpha Cup' }),
          buildPoll({ id: 'poll-2', title: 'Beta League' }),
        ]),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false,
      } as ReturnType<typeof votingFeature.usePolls>;
    });

    renderWithProviders(<PollsPage />, { authUser: adminUser });

    expect(await screen.findByText('Alpha Cup')).toBeInTheDocument();
    expect(screen.getByText('Beta League')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Поиск по названию или описанию');
    await userEvent.type(searchInput, 'beta');

    expect(screen.queryByText('Alpha Cup')).not.toBeInTheDocument();
    expect(screen.getByText('Beta League')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Черновики' }));

    const callWithDraft = paramsSpy.mock.calls.some((args) => args[0]?.status === 'draft');
    expect(callWithDraft).toBe(true);
  }, TEST_TIMEOUT_MS);

  it('renders generic error state and handles retry click', async () => {
    const refetch = vi.fn();
    vi.mocked(votingFeature.isRateLimitError).mockReturnValue(false);
    vi.mocked(votingFeature.usePolls).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('network'),
      refetch,
      isFetching: false,
    } as ReturnType<typeof votingFeature.usePolls>);

    renderWithProviders(<PollsPage />, { authUser: adminUser });

    expect(await screen.findByText('Не удалось загрузить список')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  }, TEST_TIMEOUT_MS);

  it('renders rate-limit state', async () => {
    vi.mocked(votingFeature.isRateLimitError).mockReturnValue(true);
    vi.mocked(votingFeature.usePolls).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { retryAfter: 17 },
      refetch: vi.fn(),
      isFetching: false,
    } as ReturnType<typeof votingFeature.usePolls>);

    renderWithProviders(<PollsPage />, { authUser: adminUser });

    expect(await screen.findByText('Слишком много запросов')).toBeInTheDocument();
    expect(screen.getByText('Подождите 17 сек. и попробуйте снова.')).toBeInTheDocument();
  }, TEST_TIMEOUT_MS);

  it('hides create CTA for non-admin user', async () => {
    vi.mocked(votingFeature.usePolls).mockReturnValue({
      data: buildResponse([buildPoll({ title: 'Reader Poll' })]),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as ReturnType<typeof votingFeature.usePolls>);

    renderWithProviders(<PollsPage />, { authUser: readerUser });

    expect(await screen.findByText('Reader Poll')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать опрос' })).not.toBeInTheDocument();
  }, TEST_TIMEOUT_MS);
});
