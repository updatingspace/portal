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
    Button: ({ children, loading: _loading, ...props }: React.ComponentProps<'button'> & { loading?: boolean }) => (
      <button {...props}>{children}</button>
    ),
    TextArea: ({
      value,
      onUpdate,
      minRows: _minRows,
      ...props
    }: React.ComponentProps<'textarea'> & {
      value?: string;
      onUpdate?: (nextValue: string) => void;
      minRows?: number;
    }) => (
      <textarea
        {...props}
        value={value ?? ''}
        onChange={(event) => onUpdate?.(event.target.value)}
      />
    ),
  };
});

import {
  adminVotingsApiMock,
  gamesApiMock,
  votingsApiMock,
} from '../test/mocks/api';
import { renderWithProviders, screen, userEvent, waitFor } from '../test/test-utils';
import { AdminPage } from './AdminPage';

const ADMIN_ROUTE = '/admin';
const ADMIN_GAMES_ROUTE = '/admin?section=games';
const ADMIN_VOTINGS_ROUTE = '/admin?section=votings';
const NOT_FOUND_TEXT = 'Страница не найдена';
const LOADING_VOTINGS_TEXT = 'Подтягиваем голосования...';
const MAIN_VOTING_TITLE = 'AEF Game Jam · основной поток';
const START_DASHBOARD_TEXT = 'Стартовая панель';
const ABOUT_BUTTON_LABEL = /О проекте/i;
const ABOUT_MODAL_TITLE = 'AEF Vote';

const CREATE_GAME_BUTTON_LABEL = 'Добавить игру';
const CREATE_GAME_MODAL_BUTTON_LABEL = 'Добавить';
const CREATE_GAME_PLACEHOLDER = 'Название игры';
const CREATE_GAME_TITLE = 'Новая запись';
const EXISTING_GAME_TITLE = 'Crystal Quest';

const IMPORT_JSON_BUTTON_LABEL = 'Импорт JSON';
const IMPORT_JSON_PLACEHOLDER = /Вставьте JSON/;
const PREVIEW_BUTTON_LABEL = 'Показать превью';
const IMPORT_BUTTON_LABEL = 'Импортировать';

const superuser = {
  id: 'user-1',
  username: 'root',
  email: 'root@example.com',
  isSuperuser: true,
  isStaff: true,
  displayName: 'Root',
  tenant: { id: 'tenant-1', slug: 'aef' },
} as const;

function renderAdminPage(route: string, authUser = superuser) {
  renderWithProviders(<AdminPage />, { route, authUser });
}

async function openImportVotingDialog(payload = createVotingImportPayload()) {
  const importButton = await screen.findByRole('button', { name: IMPORT_JSON_BUTTON_LABEL });
  await userEvent.click(importButton);

  const jsonArea = await screen.findByPlaceholderText(IMPORT_JSON_PLACEHOLDER);
  await userEvent.clear(jsonArea);
  fireEvent.change(jsonArea, { target: { value: JSON.stringify(payload) } });

  return {
    importButton,
    jsonArea,
    previewButton: screen.getByRole('button', { name: PREVIEW_BUTTON_LABEL }),
  };
}

async function openImportDialogAndAssertReady(payload = createVotingImportPayload()) {
  const { importButton, jsonArea, previewButton } = await openImportVotingDialog(payload);

  expect(importButton).toBeEnabled();
  expect(jsonArea).toBeInTheDocument();
  expect(previewButton).toBeEnabled();

  return { previewButton };
}

describe('AdminPage integration', () => {
  test('returns 404 for non-superuser', async () => {
    renderAdminPage(ADMIN_ROUTE, { ...superuser, isSuperuser: false, isStaff: false });

    expect(await screen.findByText(NOT_FOUND_TEXT, {}, { timeout: 3000 })).toBeInTheDocument();
  });

  test.skip('edits voting metadata via admin panel [TODO: re-enable after dialog controls are stabilized]', async () => {
    renderAdminPage(ADMIN_VOTINGS_ROUTE);

    await screen.findByText(LOADING_VOTINGS_TEXT);
    expect(await screen.findAllByText(MAIN_VOTING_TITLE)).not.toHaveLength(0);

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
    renderAdminPage(ADMIN_GAMES_ROUTE);
    expect(await screen.findByText(EXISTING_GAME_TITLE)).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: CREATE_GAME_BUTTON_LABEL });
    await userEvent.click(addBtn);

    const modalTitleInput = await screen.findByPlaceholderText(CREATE_GAME_PLACEHOLDER);
    await userEvent.type(modalTitleInput, CREATE_GAME_TITLE);

    const addModalBtn = screen.getByRole('button', { name: CREATE_GAME_MODAL_BUTTON_LABEL });
    await userEvent.click(addModalBtn);

    await waitFor(() => {
      expect(gamesApiMock.createGame).toHaveBeenCalledWith(
        expect.objectContaining({ title: CREATE_GAME_TITLE }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(CREATE_GAME_PLACEHOLDER)).not.toBeInTheDocument();
    });
  });

  test('requests voting preview when user submits import JSON', async () => {
    renderAdminPage(ADMIN_VOTINGS_ROUTE);

    const { previewButton } = await openImportDialogAndAssertReady();
    await userEvent.click(previewButton);

    await waitFor(() => {
      expect(votingsApiMock.previewVotingImport).toHaveBeenCalled();
    });
  });

  test('imports voting after preview becomes available', async () => {
    renderAdminPage(ADMIN_VOTINGS_ROUTE);

    const { previewButton } = await openImportDialogAndAssertReady();
    await userEvent.click(previewButton);

    await waitFor(() => {
      expect(votingsApiMock.previewVotingImport).toHaveBeenCalledTimes(1);
    });

    const importAction = screen.getByRole('button', { name: IMPORT_BUTTON_LABEL });
    expect(importAction).toBeEnabled();
    await userEvent.click(importAction);

    await waitFor(() => {
      expect(votingsApiMock.importVoting).toHaveBeenCalled();
    });
  });

  test('opens About Project modal from sidebar', async () => {
    renderAdminPage(ADMIN_ROUTE);

    await screen.findByText(START_DASHBOARD_TEXT);

    const aboutButton = await screen.findByRole('button', { name: ABOUT_BUTTON_LABEL });
    await userEvent.click(aboutButton);

    expect(await screen.findByText(ABOUT_MODAL_TITLE)).toBeInTheDocument();
    expect(screen.getByText(/Платформа для голосования/i)).toBeInTheDocument();
    expect(screen.getByText(/Информация о версии/i)).toBeInTheDocument();
  });
});
