import React from 'react';
import { fireEvent } from '@testing-library/react';

import { createVotingImportPayload } from '../test/fixtures';
vi.mock('@gravity-ui/uikit', async () => {
  const actual = await vi.importActual<typeof import('@gravity-ui/uikit')>('@gravity-ui/uikit');
  const DialogStub: React.FC<
    { open?: boolean; children?: React.ReactNode; onClose?: () => void }
  > & {
    Header: React.FC<{ caption?: React.ReactNode; children?: React.ReactNode }>;
    Body: React.FC<{ children?: React.ReactNode }>;
    Footer: React.FC<{
      textButtonApply?: React.ReactNode;
      textButtonCancel?: React.ReactNode;
      onClickButtonApply?: () => void;
      onClickButtonCancel?: () => void;
      children?: React.ReactNode;
    }>;
  } = ({ open = true, children }) => (open ? <div data-testid="dialog">{children}</div> : null);

  DialogStub.Header = ({ caption, children }) => (
    <div data-testid="dialog-header">{children ?? caption}</div>
  );
  DialogStub.Body = ({ children }) => <div data-testid="dialog-body">{children}</div>;
  DialogStub.Footer = ({ textButtonApply, textButtonCancel, onClickButtonApply, onClickButtonCancel, children }) => (
    <div data-testid="dialog-footer">
      <button onClick={onClickButtonCancel}>{textButtonCancel ?? 'Cancel'}</button>
      <button onClick={onClickButtonApply}>{textButtonApply ?? 'Apply'}</button>
      {children}
    </div>
  );

  return {
    ...actual,
    // Simplified modal/dialog to avoid selector parsing issues in jsdom
    Modal: ({ children }: { children?: React.ReactNode }) => <div data-testid="modal">{children}</div>,
    Dialog: DialogStub,
    Portal: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Button: ({ children, ...props }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>,
  };
});

import {
  adminVotingsApiMock,
  gamesApiMock,
  votingsApiMock,
} from '../test/mocks/api';
import { renderWithProviders, screen, userEvent, waitFor } from '../test/test-utils';
import { AdminPage } from './AdminPage';

const superuser = {
  id: 'user-1',
  username: 'root',
  email: 'root@example.com',
  isSuperuser: true,
  isStaff: true,
  displayName: 'Root',
  tenant: { id: 'tenant-1', slug: 'aef' },
} as const;

describe('AdminPage integration', () => {
  test('returns 404 for non-superuser', async () => {
    renderWithProviders(<AdminPage />, {
      authUser: { ...superuser, isSuperuser: false, isStaff: false },
    });

    expect(await screen.findByText('Страница не найдена', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  test.skip('edits voting metadata via admin panel', async () => {
    renderWithProviders(<AdminPage />, { route: '/admin?section=votings', authUser: superuser });

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
    renderWithProviders(<AdminPage />, { route: '/admin?section=games', authUser: superuser });
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
    renderWithProviders(<AdminPage />, { route: '/admin?section=votings', authUser: superuser });

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
