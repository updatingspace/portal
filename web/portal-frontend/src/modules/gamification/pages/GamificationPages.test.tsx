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

let mockUser: Record<string, unknown> | null = { id: 'u1', language: 'ru', tenant: { id: 't1' } };
let mockParams: { id?: string } = {};
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
  useQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('../../portal/api', () => ({
  fetchPortalProfiles: vi.fn(async () => []),
}));

vi.mock('../../../hooks/useGamification', () => ({
  useAchievementsList: () => ({
    data: {
      pages: [{
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
      }],
    },
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  }),
  useCategories: () => ({
    data: { items: [{ id: 'cat', nameI18n: { ru: 'Категория' } }] },
  }),
  useUpdateAchievement: () => ({ mutateAsync: mockUpdateAchievement, isPending: false }),
  useAchievement: (id?: string) => ({
    data: id
      ? {
          id,
          nameI18n: { ru: 'Тестовая ачивка' },
          description: 'Описание',
          category: 'cat',
          status: 'published',
          images: null,
          updatedAt: '2026-01-01T00:00:00Z',
          canEdit: true,
        }
      : undefined,
    isLoading: false,
  }),
  useCreateAchievement: () => ({ mutateAsync: mockCreateAchievement, isPending: false }),
  useCreateCategory: () => ({ mutateAsync: mockCreateCategory, isPending: false }),
  useCreateGrant: () => ({ mutateAsync: mockCreateGrant, isPending: false }),
  useRevokeGrant: () => ({ mutateAsync: mockRevokeGrant, isPending: false }),
  useGrantsList: () => ({
    data: {
      pages: [{ items: [{ id: 'g1', recipientId: 'u2', reason: null, visibility: 'public', createdAt: '2026-01-01T00:00:00Z' }] }],
    },
    isLoading: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
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
    <div>{data.length ? `rows:${data.length}` : emptyMessage}</div>
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
    Table,
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
    mockUser = { id: 'u1', language: 'ru', tenant: { id: 't1' } };
    mockParams = {};
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

  it('validates grant recipient in detail flow', async () => {
    mockParams = { id: 'a1' };
    render(<AchievementDetailPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Выдать' }));
    expect(await screen.findByText('Укажите user_id получателя.')).toBeInTheDocument();
    expect(mockCreateGrant).not.toHaveBeenCalled();
  });
});
