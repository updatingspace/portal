import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { GamificationDashboardPage } from './GamificationDashboardPage';
import { AchievementFormPage } from './AchievementFormPage';
import { AchievementDetailPage } from './AchievementDetailPage';

const mockNavigate = vi.fn();
const mockUpdateAchievement = vi.fn(async () => ({}));
const mockCreateAchievement = vi.fn(async () => ({ id: 'created-id' }));
const mockCreateCategory = vi.fn(async () => ({ id: 'new-category' }));
const mockCreateGrant = vi.fn(async () => ({}));
const mockRevokeGrant = vi.fn(async () => ({}));
const mockFetchNextPage = vi.fn(async () => ({}));
const mockGrantsFetchNextPage = vi.fn(async () => ({}));

let mockUser: Record<string, unknown> | null = { id: 'u1', language: 'ru', tenant: { id: 't1' } };
let mockParams: { id?: string } = {};
let mockAchievementById = true;
let mockAchievementData: Record<string, unknown> = {
  id: 'a1',
  nameI18n: { ru: 'Тестовая ачивка' },
  description: 'Описание',
  category: 'cat',
  status: 'published',
  images: null,
  updatedAt: '2026-01-01T00:00:00Z',
  canEdit: true,
};
let mockProfiles: Array<{ userId: string; firstName: string; lastName: string; displayName?: string | null; username?: string | null }> = [];
let mockAchievementsPages: Array<{ items: Array<Record<string, unknown>> }> = [{
  items: [
    {
      id: 'a1',
      nameI18n: { ru: 'A1' },
      category: 'cat',
      status: 'draft',
      updatedAt: '2026-01-01T00:00:00Z',
      canEdit: true,
      canPublish: true,
      canHide: true,
    },
    {
      id: 'a2',
      nameI18n: { ru: 'A2' },
      category: 'cat',
      status: 'published',
      updatedAt: '2026-01-01T00:00:00Z',
      canEdit: true,
      canPublish: true,
      canHide: true,
    },
  ],
}];
let mockDashboardIsLoading = false;
let mockDashboardHasNextPage = false;
let mockDashboardIsFetchingNextPage = false;
let mockGrantsPages: Array<{ items: Array<Record<string, unknown>> }> = [
  { items: [{ id: 'g1', recipientId: 'u2', reason: null, visibility: 'public', createdAt: '2026-01-01T00:00:00Z' }] },
];
let mockGrantsIsLoading = false;
let mockGrantsHasNextPage = false;
let mockGrantsIsFetchingNextPage = false;
const permissionMap = new Map<string, boolean>();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../../../features/rbac/can', () => ({
  can: (_user: unknown, permission?: string | string[]) => {
    if (!permission) return true;
    if (Array.isArray(permission)) return permission.some((p) => permissionMap.get(p));
    return permissionMap.get(permission) ?? true;
  },
}));

vi.mock('../../../features/access-denied', () => ({
  AccessDeniedScreen: () => <div>ACCESS_DENIED</div>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mockProfiles, isLoading: false }),
}));

vi.mock('../../portal/api', () => ({
  fetchPortalProfiles: vi.fn(async () => []),
}));

vi.mock('../../../hooks/useGamification', () => ({
  useAchievementsList: () => ({
    data: {
      pages: mockAchievementsPages,
    },
    isLoading: mockDashboardIsLoading,
    isFetchingNextPage: mockDashboardIsFetchingNextPage,
    hasNextPage: mockDashboardHasNextPage,
    fetchNextPage: mockFetchNextPage,
  }),
  useCategories: () => ({
    data: { items: [{ id: 'cat', nameI18n: { ru: 'Категория' } }] },
  }),
  useUpdateAchievement: () => ({ mutateAsync: mockUpdateAchievement, isPending: false }),
  useAchievement: (id?: string) => ({
    data: id
      ? (mockAchievementById
        ? { ...mockAchievementData, id }
        : undefined)
      : undefined,
    isLoading: false,
  }),
  useCreateAchievement: () => ({ mutateAsync: mockCreateAchievement, isPending: false }),
  useCreateCategory: () => ({ mutateAsync: mockCreateCategory, isPending: false }),
  useCreateGrant: () => ({ mutateAsync: mockCreateGrant, isPending: false }),
  useRevokeGrant: () => ({ mutateAsync: mockRevokeGrant, isPending: false }),
  useGrantsList: () => ({
    data: {
      pages: mockGrantsPages,
    },
    isLoading: mockGrantsIsLoading,
    hasNextPage: mockGrantsHasNextPage,
    isFetchingNextPage: mockGrantsIsFetchingNextPage,
    fetchNextPage: mockGrantsFetchNextPage,
  }),
}));

vi.mock('@gravity-ui/uikit', () => {
  const Button = ({
    children,
    onClick,
    loading: _loading,
    view: _view,
    size: _size,
    ...props
  }: React.ComponentProps<'button'> & { loading?: boolean; view?: string; size?: string }) => (
    <button type="button" onClick={onClick} {...props}>{children}</button>
  );
  const Select = ({ options = [], value = [], onUpdate }: { options?: Array<{ value: string; content: string }>; value?: string[]; onUpdate?: (v: string[]) => void }) => (
    <select value={value[0] ?? ''} onChange={(e) => onUpdate?.([e.target.value])}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.content}</option>
      ))}
    </select>
  );
  const Table = ({ data, emptyMessage }: { data: unknown[]; emptyMessage: string }) => (
    !data.length ? (
      <div>{emptyMessage}</div>
    ) : (
      <div>{`rows:${data.length}`}</div>
    )
  );
  const RichTable = ({
    data,
    columns = [],
    emptyMessage,
  }: {
    data: Array<Record<string, unknown>>;
    columns?: Array<{ id: string; template?: (row: Record<string, unknown>) => React.ReactNode }>;
    emptyMessage: string;
  }) => (
    !data.length ? (
      <div>{emptyMessage}</div>
    ) : (
      <div>
        <div>{`rows:${data.length}`}</div>
        {data.map((row) => (
          <div key={String(row.id)}>
            {columns.map((column) => (
              <div key={`${String(row.id)}-${column.id}`}>
                {column.template ? column.template(row) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  );
  const DropdownMenu = ({ items }: { items: Array<{ text: string; action?: () => void }> }) => (
    <div>{items.map((item) => <button key={item.text} onClick={item.action}>{item.text}</button>)}</div>
  );
  const Dialog = ({ open = true, children }: { open?: boolean; children?: React.ReactNode }) => (open ? <div>{children}</div> : null);
  Dialog.Header = ({ caption }: { caption?: React.ReactNode }) => <div>{caption}</div>;
  Dialog.Body = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  Dialog.Footer = ({ onClickButtonApply, onClickButtonCancel, textButtonApply, textButtonCancel }: { onClickButtonApply?: () => void; onClickButtonCancel?: () => void; textButtonApply?: string; textButtonCancel?: string }) => (
    <div>
      <button onClick={onClickButtonCancel}>{textButtonCancel ?? 'Cancel'}</button>
      <button onClick={onClickButtonApply}>{textButtonApply ?? 'Apply'}</button>
    </div>
  );

  return {
    Button,
    Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DropdownMenu,
    Icon: () => <span />,
    Label: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Select,
    Table: RichTable,
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    TextInput: ({ value = '', onUpdate, placeholder }: { value?: string; onUpdate?: (v: string) => void; placeholder?: string }) => (
      <input value={value} placeholder={placeholder} onChange={(e) => onUpdate?.(e.target.value)} />
    ),
    TextArea: ({ value = '', onUpdate }: { value?: string; onUpdate?: (v: string) => void }) => (
      <textarea value={value} onChange={(e) => onUpdate?.(e.target.value)} />
    ),
    Dialog,
  };
});

describe('Gamification pages edge cases', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUpdateAchievement.mockClear();
    mockCreateAchievement.mockClear();
    mockCreateCategory.mockClear();
    mockCreateGrant.mockClear();
    mockRevokeGrant.mockClear();
    mockFetchNextPage.mockClear();
    mockGrantsFetchNextPage.mockClear();
    mockUser = { id: 'u1', language: 'ru', tenant: { id: 't1' } };
    mockParams = {};
    mockAchievementById = true;
    mockAchievementData = {
      id: 'a1',
      nameI18n: { ru: 'Тестовая ачивка' },
      description: 'Описание',
      category: 'cat',
      status: 'published',
      images: null,
      updatedAt: '2026-01-01T00:00:00Z',
      canEdit: true,
    };
    mockProfiles = [];
    mockDashboardIsLoading = false;
    mockDashboardHasNextPage = false;
    mockDashboardIsFetchingNextPage = false;
    mockGrantsPages = [{ items: [{ id: 'g1', recipientId: 'u2', reason: null, visibility: 'public', createdAt: '2026-01-01T00:00:00Z' }] }];
    mockGrantsIsLoading = false;
    mockGrantsHasNextPage = false;
    mockGrantsIsFetchingNextPage = false;
    mockAchievementsPages = [{
      items: [
        {
          id: 'a1',
          nameI18n: { ru: 'A1' },
          category: 'cat',
          status: 'draft',
          updatedAt: '2026-01-01T00:00:00Z',
          canEdit: true,
          canPublish: true,
          canHide: true,
        },
        {
          id: 'a2',
          nameI18n: { ru: 'A2' },
          category: 'cat',
          status: 'published',
          updatedAt: '2026-01-01T00:00:00Z',
          canEdit: true,
          canPublish: true,
          canHide: true,
        },
      ],
    }];
    permissionMap.clear();
  });

  it('shows access denied on dashboard without user', () => {
    mockUser = null;
    render(<GamificationDashboardPage />);
    expect(screen.getByText('ACCESS_DENIED')).toBeInTheDocument();
  });

  it('renders dashboard metrics and scenario guidance', () => {
    render(<GamificationDashboardPage />);
    expect(screen.getByText('Центр геймификации')).toBeInTheDocument();
    expect(screen.getByText('Всего ачивок')).toBeInTheDocument();
    expect(screen.getByText('Контент-менеджер создаёт черновик и заполняет медиа/локализации.')).toBeInTheDocument();
    expect(screen.getByText('rows:2')).toBeInTheDocument();
  });

  it('executes dashboard row actions and reset filters', async () => {
    render(<GamificationDashboardPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Открыть' })[0] as HTMLButtonElement);
    fireEvent.click(screen.getAllByRole('button', { name: 'Редактировать' })[0] as HTMLButtonElement);
    fireEvent.click(screen.getAllByRole('button', { name: 'Опубликовать' })[0] as HTMLButtonElement);
    fireEvent.click(screen.getAllByRole('button', { name: 'Скрыть' })[0] as HTMLButtonElement);

    expect(mockNavigate).toHaveBeenCalledWith('/app/gamification/achievements/a1');
    expect(mockNavigate).toHaveBeenCalledWith('/app/gamification/achievements/a1/edit');
    expect(mockUpdateAchievement).toHaveBeenCalledWith({ id: 'a1', payload: { status: 'published' } });
    expect(mockUpdateAchievement).toHaveBeenCalledWith({ id: 'a1', payload: { status: 'hidden' } });

    fireEvent.change(screen.getByPlaceholderText('Поиск по названию'), { target: { value: 'abc' } });
    expect((screen.getByPlaceholderText('Поиск по названию') as HTMLInputElement).value).toBe('abc');
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
    expect((screen.getByPlaceholderText('Поиск по названию') as HTMLInputElement).value).toBe('');
  });

  it('shows load more button and triggers pagination', () => {
    mockDashboardHasNextPage = true;
    render(<GamificationDashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить ещё' }));
    expect(mockFetchNextPage).toHaveBeenCalled();
  });

  it('shows loading and empty dashboard states', () => {
    mockDashboardIsLoading = true;
    mockAchievementsPages = [{ items: [] }];
    const { rerender } = render(<GamificationDashboardPage />);
    expect(screen.getByText('Загружаем...')).toBeInTheDocument();

    mockDashboardIsLoading = false;
    rerender(<GamificationDashboardPage />);
    expect(screen.getByText('Пока нет ачивок')).toBeInTheDocument();
  });

  it('shows access denied on form when permission is missing', () => {
    permissionMap.set('gamification.achievements.create', false);
    render(<AchievementFormPage />);
    expect(screen.getByText('ACCESS_DENIED')).toBeInTheDocument();
  });

  it('validates required fields on create form', async () => {
    render(<AchievementFormPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    expect(await screen.findByText('Заполните хотя бы одно название.')).toBeInTheDocument();
  });

  it('requires category before submit and image for published status', async () => {
    render(<AchievementFormPage />);

    const localeInput = screen.getAllByPlaceholderText('ru')[0] as HTMLInputElement;
    const nameInput = screen.getByPlaceholderText('Название');
    fireEvent.change(localeInput, { target: { value: 'ru' } });
    fireEvent.change(nameInput, { target: { value: 'Новая ачивка' } });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    expect(await screen.findByText('Выберите категорию.')).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'cat' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'published' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    expect(await screen.findByText('Для публикации нужно добавить хотя бы одно изображение.')).toBeInTheDocument();
  });

  it('creates category from dialog and selects it', async () => {
    render(<AchievementFormPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить категорию' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Создать' })[1] as HTMLButtonElement);
    expect(await screen.findByText('Заполните slug и название категории.')).toBeInTheDocument();

    const slugInput = screen.getByPlaceholderText('event');
    const titleInput = screen.getByPlaceholderText('События');
    fireEvent.change(slugInput, { target: { value: 'news' } });
    fireEvent.change(titleInput, { target: { value: 'Новости' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Создать' })[1] as HTMLButtonElement);

    await vi.waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith({ id: 'news', nameI18n: { ru: 'Новости' } });
    });
  });

  it('creates achievement when minimal data is provided', async () => {
    render(<AchievementFormPage />);

    const localeInput = screen.getAllByPlaceholderText('ru')[0] as HTMLInputElement;
    const nameInput = screen.getByPlaceholderText('Название');
    fireEvent.change(localeInput, { target: { value: 'ru' } });
    fireEvent.change(nameInput, { target: { value: 'Новая ачивка' } });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'cat' } });

    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    await vi.waitFor(() => {
      expect(mockCreateAchievement).toHaveBeenCalled();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/app/gamification/achievements/created-id');
  });

  it('supports edit-mode save path and back navigation on form', async () => {
    mockParams = { id: 'a1' };
    mockAchievementData = { ...mockAchievementData, status: 'draft' };
    render(<AchievementFormPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(mockNavigate).toHaveBeenCalledWith('/app/gamification');

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await vi.waitFor(() => {
      expect(mockUpdateAchievement).toHaveBeenCalledWith({
        id: 'a1',
        payload: expect.objectContaining({
          category: 'cat',
          status: 'draft',
        }),
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith('/app/gamification/achievements/a1');
  });

  it('edits locale rows and image fields in form', () => {
    render(<AchievementFormPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить язык' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0] as HTMLButtonElement);
    fireEvent.change(screen.getByPlaceholderText('URL small'), { target: { value: '/s.png' } });
    fireEvent.change(screen.getByPlaceholderText('URL medium'), { target: { value: '/m.png' } });
    fireEvent.change(screen.getByPlaceholderText('URL large'), { target: { value: '/l.png' } });
    expect((screen.getByPlaceholderText('URL small') as HTMLInputElement).value).toBe('/s.png');
  });

  it('validates grant recipient in detail flow', async () => {
    mockParams = { id: 'a1' };
    render(<AchievementDetailPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Выдать' }));
    expect(await screen.findByText('Укажите user_id получателя.')).toBeInTheDocument();
    expect(mockCreateGrant).not.toHaveBeenCalled();
  });

  it('shows missing achievement state in detail page', () => {
    mockAchievementById = false;
    mockParams = { id: 'a404' };
    render(<AchievementDetailPage />);
    expect(screen.getByText('Ачивка не найдена.')).toBeInTheDocument();
  });

  it('renders detail media/status variants and history pagination', () => {
    mockParams = { id: 'a1' };
    mockAchievementData = {
      ...mockAchievementData,
      status: 'active',
      images: { small: '/s.png', medium: '/m.png', large: '/l.png' },
      canEdit: false,
    };
    mockGrantsPages = [{ items: [] }];
    mockGrantsHasNextPage = true;
    mockGrantsIsLoading = true;
    render(<AchievementDetailPage />);

    expect(screen.getByAltText('small')).toBeInTheDocument();
    expect(screen.getByAltText('medium')).toBeInTheDocument();
    expect(screen.getByAltText('large')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument();
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'private' } });
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить ещё' }));
    expect(mockGrantsFetchNextPage).toHaveBeenCalled();
  });

  it('selects recipient from search, grants and revokes achievement', async () => {
    mockParams = { id: 'a1' };
    mockProfiles = [{ userId: 'u77', firstName: 'Ivan', lastName: 'Petrov', username: 'ivan' }];
    render(<AchievementDetailPage />);

    fireEvent.change(screen.getByPlaceholderText('Введите имя или username'), { target: { value: 'Iv' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ivan Petrov @ivan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Выдать' }));

    await vi.waitFor(() => {
      expect(mockCreateGrant).toHaveBeenCalledWith({
        achievementId: 'a1',
        payload: { recipientId: 'u77', reason: undefined, visibility: 'public' },
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отозвать' }));
    await vi.waitFor(() => expect(mockRevokeGrant).toHaveBeenCalledWith({ grantId: 'g1' }));
  });

  it('hides grant form when assign permission is missing and supports detail back button', () => {
    mockParams = { id: 'a1' };
    permissionMap.set('gamification.achievements.assign', false);
    render(<AchievementDetailPage />);
    expect(screen.queryByText('Выдать ачивку')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(mockNavigate).toHaveBeenCalledWith('/app/gamification');
  });
});
