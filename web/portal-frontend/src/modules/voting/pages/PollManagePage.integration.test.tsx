import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../features/voting/api/votingApi', async () => {
  const actual = await vi.importActual<typeof import('../../../features/voting/api/votingApi')>(
    '../../../features/voting/api/votingApi',
  );

  return {
    ...actual,
    fetchPollInfo: vi.fn(),
    fetchParticipants: vi.fn(),
    updatePoll: vi.fn(),
    deletePoll: vi.fn(),
    createNomination: vi.fn(),
    updateNomination: vi.fn(),
    deleteNomination: vi.fn(),
    createOption: vi.fn(),
    updateOption: vi.fn(),
    deleteOption: vi.fn(),
    addParticipant: vi.fn(),
    removeParticipant: vi.fn(),
  };
});

import * as votingApi from '../../../features/voting/api/votingApi';
import type { NominationWithOptions, Poll, PollDetailedInfo } from '../../../features/voting/types';
import { renderWithProviders, screen, userEvent, waitFor } from '../../../test/test-utils';
import { PollManagePage } from './PollManagePage';

const poll: Poll = {
  id: 'poll-1',
  tenant_id: 'tenant-1',
  title: 'Черновик голосования',
  description: 'Настройка опроса',
  status: 'draft',
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
};

const buildNomination = (overrides: Partial<NominationWithOptions> = {}): NominationWithOptions => ({
  id: 'nom-1',
  poll_id: poll.id,
  title: 'Вопрос 1',
  description: 'Описание',
  kind: 'custom',
  sort_order: 0,
  max_votes: 1,
  is_required: false,
  config: {},
  options: [],
  ...overrides,
});

const buildPollInfo = (nominations: NominationWithOptions[]): PollDetailedInfo => ({
  poll,
  nominations,
  meta: {
    has_voted: false,
    can_vote: true,
  },
});

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/app/voting/:id/manage" element={<PollManagePage />} />
    </Routes>,
    {
      route: '/app/voting/poll-1/manage',
      authUser: {
        id: 'user-1',
        username: 'admin',
        email: 'admin@example.com',
        isSuperuser: true,
        isStaff: true,
        displayName: 'Admin',
        tenant: { id: 'tenant-1', slug: 'aef' },
        capabilities: ['voting.votings.admin'],
      },
    },
  );

describe('PollManagePage integration', () => {
  it('supports settings save/reset flow', async () => {
    vi.mocked(votingApi.fetchPollInfo).mockResolvedValue(buildPollInfo([buildNomination()]));
    vi.mocked(votingApi.fetchParticipants).mockResolvedValue([]);
    vi.mocked(votingApi.updatePoll).mockResolvedValue({ ...poll, title: 'Обновлённый заголовок' });

    renderPage();

    const titleInput = (await screen.findByDisplayValue('Черновик голосования')) as HTMLInputElement;
    expect(titleInput).toHaveValue('Черновик голосования');

    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Обновлённый заголовок');

    await userEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
    expect(titleInput).toHaveValue('Черновик голосования');

    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Обновлённый заголовок');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(votingApi.updatePoll).toHaveBeenCalledWith(
        poll.id,
        expect.objectContaining({
          title: 'Обновлённый заголовок',
        }),
      );
    });
  }, 15000);

  it('renders publish checklist and blocks publish when requirements are not met', async () => {
    vi.mocked(votingApi.fetchPollInfo).mockResolvedValue(buildPollInfo([buildNomination({ options: [] })]));
    vi.mocked(votingApi.fetchParticipants).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('Опрос не готов к публикации')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeDisabled();
    expect(screen.getAllByText('Вопрос «Вопрос 1» должен иметь хотя бы один вариант.').length).toBeGreaterThan(0);
  }, 15000);

  it('shows questions workspace and add-question action', async () => {
    vi.mocked(votingApi.fetchPollInfo).mockResolvedValue(buildPollInfo([]));
    vi.mocked(votingApi.fetchParticipants).mockResolvedValue([]);

    renderPage();

    await screen.findByText('Черновик голосования');
    await userEvent.click(screen.getByRole('tab', { name: 'Вопросы (0)' }));
    expect(screen.getAllByRole('button', { name: 'Добавить вопрос' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Вопросов пока нет')).toBeInTheDocument();
  }, 15000);
});
