import React from 'react';
import { Route, Routes, useLocation, useParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../features/voting/api/votingApi', async () => {
  const actual = await vi.importActual<typeof import('../../../features/voting/api/votingApi')>(
    '../../../features/voting/api/votingApi',
  );

  return {
    ...actual,
    fetchPollTemplates: vi.fn(),
    createPoll: vi.fn(),
  };
});

import * as votingApi from '../../../features/voting/api/votingApi';
import type { Poll, PollTemplate } from '../../../features/voting/types';
import { renderWithProviders, screen, userEvent, waitFor } from '../../../test/test-utils';
import { PollCreatePage } from './PollCreatePage';

const templates: PollTemplate[] = [
  {
    slug: 'awards',
    title: 'Премия сообщества',
    description: 'Выбор лучших проектов сообщества',
    visibility: 'public',
    settings: {
      allow_revoting: true,
      results_visibility: 'after_closed',
    },
    questions: [
      {
        title: 'Лучшая игра',
      },
    ],
  },
  {
    slug: 'quick-poll',
    title: 'Быстрый опрос',
    description: 'Один вопрос, быстрый запуск',
    visibility: 'public',
    settings: {},
    questions: [],
  },
];

const createdPoll: Poll = {
  id: 'poll-new',
  tenant_id: 'tenant-1',
  title: 'Новый опрос',
  description: null,
  status: 'draft',
  scope_type: 'TENANT',
  scope_id: 'tenant-1',
  visibility: 'public',
  template: 'awards',
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

const ManageProbe: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const tab = (location.state as { tab?: string } | null)?.tab ?? 'none';

  return <div>{`manage:${id}:${tab}`}</div>;
};

describe('PollCreatePage integration', () => {
  it('shows loading state for templates', () => {
    vi.mocked(votingApi.fetchPollTemplates).mockImplementationOnce(() => new Promise(() => undefined));

    renderWithProviders(<PollCreatePage />);

    expect(screen.getByText('Загружаем шаблоны опросов…')).toBeInTheDocument();
  });

  it('supports template and blank creation paths', async () => {
    vi.mocked(votingApi.fetchPollTemplates).mockResolvedValue(templates);
    vi.mocked(votingApi.createPoll).mockResolvedValue(createdPoll);

    renderWithProviders(
      <Routes>
        <Route path="/app/voting/create" element={<PollCreatePage />} />
        <Route path="/app/voting/:id/manage" element={<ManageProbe />} />
      </Routes>,
      {
        route: '/app/voting/create',
      },
    );

    expect(await screen.findByText('Создание опроса')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Начать с нуля' }));
    expect(await screen.findByText('Новый опрос')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Назад к выбору старта' }));
    expect(await screen.findByText('Создание опроса')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Использовать шаблон' })[0]);
    expect(await screen.findByText('Создание по шаблону «Премия сообщества»')).toBeInTheDocument();
  }, 15000);

  it('creates poll and navigates to manage page', async () => {
    vi.mocked(votingApi.fetchPollTemplates).mockResolvedValue(templates);
    vi.mocked(votingApi.createPoll).mockResolvedValue(createdPoll);

    renderWithProviders(
      <Routes>
        <Route path="/app/voting/create" element={<PollCreatePage />} />
        <Route path="/app/voting/:id/manage" element={<ManageProbe />} />
      </Routes>,
      {
        route: '/app/voting/create',
      },
    );

    await screen.findByText('Создание опроса');
    await userEvent.click(screen.getByRole('button', { name: 'Начать с нуля' }));

    const titleInput = await screen.findByLabelText('Название');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Опрос квартала');

    await userEvent.click(screen.getByRole('button', { name: 'Создать опрос' }));

    await waitFor(() => {
      expect(votingApi.createPoll).toHaveBeenCalled();
    });
    const firstPayload = vi.mocked(votingApi.createPoll).mock.calls[0]?.[0];
    expect(firstPayload).toMatchObject({
      title: 'Опрос квартала',
    });

    expect(await screen.findByText('manage:poll-new:questions')).toBeInTheDocument();
  }, 15000);
});
