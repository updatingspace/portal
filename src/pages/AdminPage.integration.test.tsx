import React from 'react';
import { fireEvent } from '@testing-library/react';
import { beforeEach } from 'vitest';

import { createSuperuserProfile, createVotingImportPayload } from '../test/fixtures';
import {
  adminVotingsApiMock,
  gamesApiMock,
  serviceApiMock,
  votingsApiMock,
} from '../test/mocks/api';
import { renderWithProviders, screen, userEvent, waitFor } from '../test/test-utils';
import { AdminPage } from './AdminPage';

describe('AdminPage integration', () => {
  beforeEach(() => {
    serviceApiMock.me.mockReset();
    serviceApiMock.me.mockResolvedValue(createSuperuserProfile());
  });

  test('returns 404 for non-superuser', async () => {
    const guestProfile = { ...createSuperuserProfile(), is_superuser: false, is_staff: false };
    serviceApiMock.me.mockResolvedValue(guestProfile);

    renderWithProviders(<AdminPage />);

    expect(await screen.findByText('Страница не найдена', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  test('edits voting metadata via admin panel', async () => {
    renderWithProviders(<AdminPage />, { route: '/admin?section=votings' });

    await screen.findByText('Подтягиваем голосования...');
    expect(await screen.findAllByText('AEF Game Jam · основной поток')).not.toHaveLength(0);

    const editBtn = screen.getByRole('button', { name: /Редактировать/i });
    await userEvent.click(editBtn);

    const titleInput = screen.getByPlaceholderText('Название голосования');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Новое название голосования');

    const saveBtn = screen.getByRole('button', { name: 'Сохранить' });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(adminVotingsApiMock.updateAdminVotingMeta).toHaveBeenCalledWith(
        'vote-active',
        expect.objectContaining({ title: 'Новое название голосования' }),
      );
    });
    expect(screen.getAllByText('Новое название голосования')[0]).toBeInTheDocument();
  });

  test('creates a new game from games section', async () => {
    renderWithProviders(<AdminPage />, { route: '/admin?section=games' });
    expect(await screen.findByText('Crystal Quest')).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: 'Добавить игру' });
    await userEvent.click(addBtn);

    const modalTitleInput = await screen.findByPlaceholderText('Название игры');
    await userEvent.type(modalTitleInput, 'Новая запись');

    const addModalBtn = screen.getByRole('button', { name: 'Добавить' });
    await userEvent.click(addModalBtn);

    await waitFor(() => {
      expect(gamesApiMock.createGame).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Новая запись' }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Название игры')).not.toBeInTheDocument();
    });
  });

  test('shows preview and imports voting JSON', async () => {
    const payload = createVotingImportPayload();
    renderWithProviders(<AdminPage />, { route: '/admin?section=votings' });

    const importButton = await screen.findByRole('button', { name: 'Импорт JSON' });
    await userEvent.click(importButton);

    const jsonArea = await screen.findByPlaceholderText(/Вставьте JSON/);
    await userEvent.clear(jsonArea);
    fireEvent.change(jsonArea, { target: { value: JSON.stringify(payload) } });

    const previewBtn = screen.getByRole('button', { name: 'Показать превью' });
    await userEvent.click(previewBtn);

    await waitFor(() => {
      expect(votingsApiMock.previewVotingImport).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Импортировать' })).toBeEnabled();
    });

    const importAction = screen.getByRole('button', { name: 'Импортировать' });
    await userEvent.click(importAction);

    await waitFor(() => {
      expect(votingsApiMock.importVoting).toHaveBeenCalled();
    });
  });

  test('opens About Project modal from sidebar', async () => {
    renderWithProviders(<AdminPage />, { route: '/admin' });

    // Wait for admin page to load
    await screen.findByText('Стартовая панель');

    // Find and click the "О проекте" button
    const aboutButton = await screen.findByRole('button', { name: /О проекте/i });
    await userEvent.click(aboutButton);

    // Verify modal opens with version information
    expect(await screen.findByText('AEF Vote')).toBeInTheDocument();
    expect(screen.getByText(/Платформа для голосования/i)).toBeInTheDocument();
    expect(screen.getByText(/Информация о версии/i)).toBeInTheDocument();
    expect(screen.getByText(/Фронтенд:/i)).toBeInTheDocument();
    expect(screen.getByText(/Бэкенд:/i)).toBeInTheDocument();
  });
});
