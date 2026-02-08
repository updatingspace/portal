import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../features/voting', async () => {
  const actual = await vi.importActual<typeof import('../../../features/voting')>('../../../features/voting');

  return {
    ...actual,
    usePollTemplates: vi.fn(),
  };
});

import * as votingFeature from '../../../features/voting';
import type { PollTemplate } from '../../../features/voting/types';
import { renderWithProviders, screen, userEvent } from '../../../test/test-utils';
import { PollTemplatesPage } from './PollTemplatesPage';

const CreateProbe: React.FC = () => {
  const location = useLocation();
  const template = (location.state as { template?: string } | null)?.template ?? 'none';

  return <div>{`create:${template}`}</div>;
};

const templates: PollTemplate[] = [
  {
    slug: 'community-awards',
    title: 'Community Awards',
    description: 'Выбор лучших игроков и команд',
    visibility: 'public',
    settings: {},
    questions: [{ title: 'Игрок года' }],
  },
];

describe('PollTemplatesPage integration', () => {
  it('renders empty state', async () => {
    vi.mocked(votingFeature.usePollTemplates).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof votingFeature.usePollTemplates>);

    renderWithProviders(<PollTemplatesPage />);

    expect(await screen.findByText('Шаблонов пока нет')).toBeInTheDocument();
  });

  it('renders error state and retries', async () => {
    const refetch = vi.fn();
    vi.mocked(votingFeature.usePollTemplates).mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('failed'),
      refetch,
    } as ReturnType<typeof votingFeature.usePollTemplates>);

    renderWithProviders(<PollTemplatesPage />);

    expect(await screen.findByText('Не удалось загрузить шаблоны')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('navigates to create flow with selected template', async () => {
    vi.mocked(votingFeature.usePollTemplates).mockReturnValue({
      data: templates,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof votingFeature.usePollTemplates>);

    renderWithProviders(
      <Routes>
        <Route path="/app/voting/templates" element={<PollTemplatesPage />} />
        <Route path="/app/voting/create" element={<CreateProbe />} />
      </Routes>,
      {
        route: '/app/voting/templates',
      },
    );

    expect(await screen.findByText('Community Awards')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Использовать шаблон' }));
    expect(await screen.findByText('create:community-awards')).toBeInTheDocument();
  });
});
