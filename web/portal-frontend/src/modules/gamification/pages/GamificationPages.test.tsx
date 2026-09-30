import {I18nProvider} from '../../../app/providers/I18nProvider';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';

import { GamificationDashboardPage } from './GamificationDashboardPage';
import { AchievementFormPage } from './AchievementFormPage';
import { AchievementDetailPage } from './AchievementDetailPage';

const render = (ui: React.ReactElement) => rtlRender(<I18nProvider>{ui}</I18nProvider>);
vi.mock('../../../contexts/TenantContext', () => ({useTenantContext: () => ({activeTenant:{tenant_id:'t1',tenant_slug:'alpha'}}), useTenant: () => ({tenant_id:'t1',tenant_slug:'alpha'})}));
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
    loading,
    view,
    size,
    ...props
  }: React.ComponentProps<'button'> & { loading?: boolean; view?: string; size?: string }) => {
    void loading;
    void view;
    void size;
    return <button type="button" onClick={onClick} {...props}>{children}</button>;
  };
  const Select = ({ id, options = [], value = [], onUpdate }: { id?:string; options?: Array<{ value: string; content: string }>; value?: string[]; onUpdate?: (v: string[]) => void }) => (
    <select id={id} value={value[0] ?? ''} onChange={(e) => onUpdate?.([e.target.value])}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.content}</option>
      ))}
    </select>
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
  const Dialog = ({ open = true, children }: { open?: boolean; children?: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null);
  Dialog.Header = ({ caption }: { caption?: React.ReactNode }) => <div>{caption}</div>;
  Dialog.Body = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  Dialog.Footer = ({ children, onClickButtonApply, onClickButtonCancel, textButtonApply, textButtonCancel }: { children?: React.ReactNode; onClickButtonApply?: () => void; onClickButtonCancel?: () => void; textButtonApply?: string; textButtonCancel?: string }) => children ?? (
    <div>
      <button onClick={onClickButtonCancel}>{textButtonCancel ?? 'Cancel'}</button>
      <button onClick={onClickButtonApply}>{textButtonApply ?? 'Apply'}</button>
    </div>
  );

  return {
    Button,
    Loader:()=> <span>Загрузка</span>,
    Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DropdownMenu,
    Icon: () => <span />,
    Label: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Select,
    Table: RichTable,
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    TextInput: ({ id, value = '', onUpdate, placeholder }: { id?:string; value?: string; onUpdate?: (v: string) => void; placeholder?: string }) => (
      <input id={id} value={value} placeholder={placeholder} onChange={(e) => onUpdate?.(e.target.value)} />
    ),
    TextArea: ({ id, value = '', onUpdate }: { id?:string; value?: string; onUpdate?: (v: string) => void }) => (
      <textarea id={id} value={value} onChange={(e) => onUpdate?.(e.target.value)} />
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
    expect(screen.getByText('Достижения недоступны')).toBeInTheDocument();
  });

  it('opens directly on the catalog without decorative counts or instructions', () => {
    render(<GamificationDashboardPage />);
    expect(screen.getByRole('heading',{name:'Достижения'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'A1',exact:true})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'A2',exact:true})).toBeInTheDocument();
    expect(screen.queryByText('Загружено достижений')).not.toBeInTheDocument();
  });

  it('executes dashboard row actions and reset filters', async () => {
    render(<GamificationDashboardPage />);

    fireEvent.click(screen.getByRole('button', {name:'A1',exact:true}));
    fireEvent.click(screen.getAllByRole('button', { name: 'Редактировать' })[0] as HTMLButtonElement);
    fireEvent.click(screen.getAllByRole('button', { name: 'Опубликовать' })[0] as HTMLButtonElement);
    fireEvent.click(screen.getAllByRole('button', { name: 'Скрыть' })[0] as HTMLButtonElement);

    expect(mockNavigate).toHaveBeenCalledWith('/app/gamification/achievements/a1');
    expect(mockNavigate).toHaveBeenCalledWith('/app/gamification/achievements/a1/edit');
    expect(mockUpdateAchievement).toHaveBeenCalledWith({ id: 'a1', payload: { status: 'published' } });
    expect(mockUpdateAchievement).toHaveBeenCalledWith({ id: 'a1', payload: { status: 'hidden' } });

    fireEvent.change(screen.getByPlaceholderText('Поиск по названию'), { target: { value: 'abc' } });
    expect((screen.getByPlaceholderText('Поиск по названию') as HTMLInputElement).value).toBe('abc');
    fireEvent.click(screen.getByRole('button', { name: /^Фильтры/ }));
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
    expect(screen.getByText('Загружаем достижения')).toBeInTheDocument();

    mockDashboardIsLoading = false;
    rerender(<GamificationDashboardPage />);
    expect(screen.getByText('Достижений пока нет')).toBeInTheDocument();
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

    const nameInput = screen.getByLabelText('Название', {exact:true});
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
    expect(await screen.findByText('Заполните название и адрес категории.')).toBeInTheDocument();

    const slugInput = screen.getByLabelText('Адрес категории');
    const titleInput = screen.getByLabelText('Название категории');
    fireEvent.change(slugInput, { target: { value: 'news' } });
    fireEvent.change(titleInput, { target: { value: 'Новости' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Создать' })[1] as HTMLButtonElement);

    await vi.waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith({ id: 'news', nameI18n: { ru: 'Новости' } });
    });
  });

  it('creates achievement when minimal data is provided', async () => {
    render(<AchievementFormPage />);

    const nameInput = screen.getByLabelText('Название', {exact:true});
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

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[1] as HTMLButtonElement);
    fireEvent.change(screen.getByLabelText('Маленькое изображение'), { target: { value: '/s.png' } });
    fireEvent.change(screen.getByLabelText('Изображение',{exact:true}), { target: { value: '/m.png' } });
    fireEvent.change(screen.getByLabelText('Большое изображение'), { target: { value: '/l.png' } });
    expect((screen.getByLabelText('Маленькое изображение') as HTMLInputElement).value).toBe('/s.png');
  });

  it('validates grant recipient in detail flow', async () => {
    mockParams = { id: 'a1' };
    render(<AchievementDetailPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Выдать награду' }));
    fireEvent.click(screen.getByRole('button', { name: 'Выдать',exact:true }));
    expect(await screen.findByText('Выберите участника из результатов поиска.')).toBeInTheDocument();
    expect(mockCreateGrant).not.toHaveBeenCalled();
  });

  it('shows missing achievement state in detail page', () => {
    mockAchievementById = false;
    mockParams = { id: 'a404' };
    render(<AchievementDetailPage />);
    expect(screen.getByText('Достижение не найдено')).toBeInTheDocument();
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

    expect(screen.getByAltText('Тестовая ачивка')).toHaveAttribute('src','/l.png');
    expect(screen.getAllByRole('img')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'История выдач'}));
    expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument();
    expect(screen.getByText('Загружаем историю…')).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'private' } });
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить ещё' }));
    expect(mockGrantsFetchNextPage).toHaveBeenCalled();
  });

  it('selects recipient from search, grants and revokes achievement', async () => {
    mockParams = { id: 'a1' };
    mockProfiles = [{ userId: 'u77', firstName: 'Ivan', lastName: 'Petrov', username: 'ivan' }];
    render(<AchievementDetailPage />);

    fireEvent.click(screen.getByRole('button',{name:'Выдать награду'}));
    fireEvent.change(screen.getByPlaceholderText('Введите имя или username'), { target: { value: 'Iv' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ivan Petrov @ivan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Выдать' }));

    await vi.waitFor(() => {
      expect(mockCreateGrant).toHaveBeenCalledWith({
        achievementId: 'a1',
        payload: { recipientId: 'u77', reason: undefined, visibility: 'public' },
      });
    });
    fireEvent.click(screen.getByRole('button',{name:'История выдач'}));
    fireEvent.click(screen.getByRole('button', { name: 'Отозвать' }));
    expect(mockRevokeGrant).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm', exact: true }));
    await vi.waitFor(() => expect(mockRevokeGrant).toHaveBeenCalledWith({ grantId: 'g1' }));
  });

  it('hides grant form when assign permission is missing and supports detail back button', () => {
    mockParams = { id: 'a1' };
    permissionMap.set('gamification.achievements.assign', false);
    render(<AchievementDetailPage />);
    expect(screen.queryByRole('button',{name:'Выдать награду'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(mockNavigate).toHaveBeenCalledWith('/app/gamification');
  });
  it('keeps form fields after a failed write', async()=>{
    mockCreateAchievement.mockRejectedValueOnce(new Error('Offline'));
    render(<AchievementFormPage/>);
    fireEvent.change(screen.getByLabelText('Название',{exact:true}),{target:{value:'Помощь команде'}});
    fireEvent.change(screen.getByLabelText('Категория'),{target:{value:'cat'}});
    fireEvent.click(screen.getByRole('button',{name:'Создать',exact:true}));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Название',{exact:true})).toHaveValue('Помощь команде');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
  it('requires selecting a recipient again when the search is edited', async()=>{
    mockParams={id:'a1'};
    mockProfiles=[{userId:'u77',firstName:'Ivan',lastName:'Petrov'}];
    render(<AchievementDetailPage/>);
    fireEvent.click(screen.getByRole('button',{name:'Выдать награду'}));
    fireEvent.change(screen.getByLabelText('Участник'),{target:{value:'Ivan'}});
    fireEvent.click(screen.getByRole('button',{name:'Ivan Petrov'}));
    fireEvent.change(screen.getByLabelText('Участник'),{target:{value:'Другой'}});
    fireEvent.click(screen.getByRole('button',{name:'Выдать',exact:true}));
    await screen.findByText('Выберите участника из результатов поиска.');
    expect(mockCreateGrant).not.toHaveBeenCalled();
  });

});
