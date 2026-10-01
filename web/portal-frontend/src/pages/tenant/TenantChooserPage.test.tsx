import type { ReactNode } from 'react';
import { ThemeProvider } from '@gravity-ui/uikit';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantChooserPage } from './TenantChooserPage';
import {
  fetchEntryMe,
  submitTenantApplication,
  type EntryMeResponse,
} from '../../api/tenant';
const state = vi.hoisted(() => ({
  switch: vi.fn(),
  setTenants: vi.fn(),
  admin: false,
}));
vi.mock('../../api/tenant', () => ({
  fetchEntryMe: vi.fn(),
  submitTenantApplication: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', displayName: 'Игрок', isSuperuser: state.admin },
  }),
}));
vi.mock('../../contexts/TenantContext', () => ({
  useTenantContext: () => ({
    doSwitchTenant: state.switch,
    setAvailableTenants: state.setTenants,
  }),
}));
vi.mock('../../widgets/app-shell/ThemeSelect', () => ({
  ThemeSelect: () => <div>Theme switcher</div>,
}));
vi.mock('../../widgets/app-shell/AuthActions', () => ({
  AuthActions: ({
    extraItems = [],
  }: {
    extraItems?: { text: string; action: () => void }[];
  }) => (
    <div>
      {extraItems.map((item) => (
        <button key={item.text} onClick={item.action}>
          {item.text}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('./TenantApplicationReviewPanel', () => ({
  TenantApplicationReviewPanel: () => <div>Review applications</div>,
}));
// Dialog focus/portals are covered in Playwright; jsdom cannot parse Gravity's scoped selectors.
vi.mock('../../shared/ui/portal/ContentDialog', () => ({
  ContentDialog: ({
    children,
    title,
    onClose,
    busy,
  }: {
    children: ReactNode;
    title: string;
    onClose: () => void;
    busy?: boolean;
  }) => (
    <section role="dialog" aria-label={title}>
      <h2>{title}</h2>
      <button onClick={onClose} disabled={busy}>
        Закрыть
      </button>
      {children}
    </section>
  ),
}));
const empty: EntryMeResponse = {
  user: { id: 'u1' },
  memberships: [],
  last_tenant: null,
  pending_tenant_applications: [],
};
const memberships: EntryMeResponse['memberships'] = [
  {
    tenant_id: 'a',
    tenant_slug: 'alpha',
    display_name: 'Альфа',
    status: 'active',
    base_role: 'owner',
  },
  {
    tenant_id: 'b',
    tenant_slug: 'beta',
    display_name: 'Бета',
    status: 'active',
    base_role: 'member',
  },
];
function setup() {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<TenantChooserPage />} />
          <Route
            path="/t/:tenantSlug/*"
            element={<div>Community overview</div>}
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}
async function openForm() {
  await userEvent.click(
    await screen.findByRole('button', { name: 'Подать заявку' }),
  );
}
async function fillForm() {
  await openForm();
  await userEvent.type(
    screen.getByLabelText('Название', { exact: true }),
    'New community',
  );
  await userEvent.type(
    screen.getByLabelText('Адрес сообщества', { exact: true }),
    'new-community',
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  state.admin = false;
  vi.mocked(fetchEntryMe).mockResolvedValue(empty);
  state.switch.mockResolvedValue(true);
});
describe('My communities', () => {
  it('shows a defined loading state', () => {
    vi.mocked(fetchEntryMe).mockReturnValue(new Promise(() => {}));
    setup();
    expect(screen.getByText('Загружаем сообщества')).toBeVisible();
    expect(screen.queryByText(/У вас пока нет/)).not.toBeInTheDocument();
  });
  it('offers both paths when there are no communities', async () => {
    setup();
    expect(
      await screen.findByRole('heading', {
        name: 'Присоединиться по приглашению',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Создать сообщество' }),
    ).toBeVisible();
  });
  it('opens a verified membership', async () => {
    vi.mocked(fetchEntryMe).mockResolvedValue({ ...empty, memberships });
    setup();
    await userEvent.click(
      (await screen.findAllByRole('button', { name: /Открыть сообщество/ }))[0],
    );
    expect(await screen.findByText('Community overview')).toBeVisible();
    expect(state.switch).toHaveBeenCalledWith('alpha');
  });
  it('keeps a switch error next to the selected community', async () => {
    state.switch.mockResolvedValue(false);
    vi.mocked(fetchEntryMe).mockResolvedValue({ ...empty, memberships });
    setup();
    await userEvent.click(
      (await screen.findAllByRole('button', { name: /Открыть сообщество/ }))[0],
    );
    expect(
      await screen.findByText(
        'Не удалось открыть сообщество. Повторите попытку.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('Community overview')).not.toBeInTheDocument();
  });
  it('disables competing selections during a switch', async () => {
    state.switch.mockReturnValue(new Promise(() => {}));
    vi.mocked(fetchEntryMe).mockResolvedValue({ ...empty, memberships });
    setup();
    const buttons = await screen.findAllByRole('button', {
      name: /Открыть сообщество/,
    });
    await userEvent.click(buttons[0]);
    expect(buttons[1]).toBeDisabled();
    expect(state.switch).toHaveBeenCalledTimes(1);
  });
  it('distinguishes inactive membership', async () => {
    vi.mocked(fetchEntryMe).mockResolvedValue({
      ...empty,
      memberships: [{ ...memberships[0], status: 'invited' }],
    });
    setup();
    expect(
      await screen.findByText(
        'Ваш доступ к этому сообществу сейчас неактивен.',
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Открыть сообщество/ }),
    ).toBeDisabled();
  });
  it('uses the slug when no display name is available', async () => {
    vi.mocked(fetchEntryMe).mockResolvedValue({
      ...empty,
      memberships: [{ ...memberships[0], display_name: undefined }],
    });
    setup();
    expect(
      await screen.findByRole('button', { name: 'Открыть сообщество alpha' }),
    ).toBeVisible();
  });
  it('does not confuse a failed request with no memberships', async () => {
    vi.mocked(fetchEntryMe).mockRejectedValueOnce(new Error('offline'));
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось загрузить',
    );
    expect(screen.queryByText(/У вас пока нет/)).not.toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('alert')).getByRole('button'),
    );
    expect(await screen.findByText(/У вас пока нет/)).toBeVisible();
  });
  it.each(['pending', 'provisioning', 'approved', 'rejected'] as const)(
    'keeps %s application alongside existing access',
    async (status) => {
      vi.mocked(fetchEntryMe).mockResolvedValue({
        ...empty,
        memberships: [memberships[0]],
        tenant_applications: [
          { id: 'application', slug: 'new-community', status },
        ],
      });
      setup();
      expect(await screen.findByText('/new-community')).toBeVisible();
      expect(
        screen.getByRole('button', { name: /Открыть сообщество/ }),
      ).toBeVisible();
    },
  );
  it('validates empty and reserved addresses without sending', async () => {
    setup();
    await openForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'Отправить заявку' }),
    );
    expect(await screen.findByText('Введите название')).toBeVisible();
    await userEvent.type(
      screen.getByLabelText('Название', { exact: true }),
      'Team',
    );
    await userEvent.type(
      screen.getByLabelText('Адрес сообщества', { exact: true }),
      'admin',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Отправить заявку' }),
    );
    expect(await screen.findByText('Этот адрес зарезервирован')).toBeVisible();
    expect(submitTenantApplication).not.toHaveBeenCalled();
  });
  it('submits without requiring email and shows the returned application history', async () => {
    vi.mocked(submitTenantApplication).mockResolvedValue({
      id: 'app',
      slug: 'new-community',
      status: 'pending',
    });
    setup();
    await fillForm();
    vi.mocked(fetchEntryMe).mockResolvedValue({
      ...empty,
      pending_tenant_applications: [
        { id: 'app', slug: 'new-community', status: 'pending' },
      ],
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Отправить заявку' }),
    );
    expect(await screen.findByText('На рассмотрении')).toBeVisible();
    expect(submitTenantApplication).toHaveBeenCalledWith({
      name: 'New community',
      slug: 'new-community',
      description: '',
    });
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });
  it('retains input after server rejection', async () => {
    vi.mocked(submitTenantApplication).mockRejectedValue({
      code: 'SLUG_TAKEN',
    });
    setup();
    await fillForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'Отправить заявку' }),
    );
    expect(
      await screen.findByText('Этот адрес уже занят. Выберите другой.'),
    ).toBeVisible();
    expect(screen.getByLabelText('Название', { exact: true })).toHaveValue(
      'New community',
    );
  });
  it('explains how to obtain an invitation without a fake token', async () => {
    setup();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Как присоединиться' }),
    );
    expect(screen.getByText(/Откройте полученную ссылку/)).toBeVisible();
  });
  it('shows platform review for a system administrator without a tenant', async () => {
    state.admin = true;
    setup();
    await screen.findByRole('button', { name: 'Рассмотреть заявки' });
    expect(screen.queryByText('Review applications')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Рассмотреть заявки' }),
    );
    expect(await screen.findByText('Review applications')).toBeVisible();
  });
});

it('welcomes the user without a theme switcher or repeated identity', async () => {
  setup();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'В какой спейс сегодня?',
  );
  expect(screen.queryByText('Theme switcher')).not.toBeInTheDocument();
  expect(screen.queryByText('Игрок')).not.toBeInTheDocument();
  await screen.findByRole('button', { name: 'Подать заявку' });
});
it('discloses search, filters the list and restores it on close', async () => {
  vi.mocked(fetchEntryMe).mockResolvedValue({ ...empty, memberships });
  setup();
  await screen.findByRole('button', { name: 'Открыть сообщество Альфа' });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'Поиск сообществ' }),
  );
  const input = screen.getByRole('textbox', { name: 'Найти сообщество' });
  expect(input).toHaveFocus();
  await userEvent.type(input, 'нет совпадений');
  expect(screen.getByText('Ничего не нашлось')).toBeVisible();
  await userEvent.clear(input);
  await userEvent.type(input, 'бета');
  expect(
    screen.queryByRole('button', { name: 'Открыть сообщество Альфа' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Открыть сообщество Бета' }),
  ).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Закрыть поиск' }));
  expect(
    screen.getByRole('button', { name: 'Открыть сообщество Альфа' }),
  ).toBeVisible();
});
it('opens the application from the plus and retains a dismissed draft', async () => {
  vi.mocked(fetchEntryMe).mockResolvedValue({ ...empty, memberships });
  setup();
  await screen.findByRole('button', { name: 'Открыть сообщество Альфа' });
  expect(
    screen.queryByRole('heading', { name: 'Создать сообщество' }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'Создать сообщество' }),
  );
  await userEvent.type(
    screen.getByLabelText('Название', { exact: true }),
    'My space',
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Закрыть', exact: true }),
  );
  expect(
    screen.queryByLabelText('Название', { exact: true }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'Создать сообщество' }),
  );
  expect(screen.getByLabelText('Название', { exact: true })).toHaveValue(
    'My space',
  );
});
it('does not duplicate an approved application once membership exists', async () => {
  vi.mocked(fetchEntryMe).mockResolvedValue({
    ...empty,
    memberships,
    tenant_applications: [{ id: 'app', slug: 'alpha', status: 'approved' }],
  });
  setup();
  await screen.findByRole('button', { name: 'Открыть сообщество Альфа' });
  expect(screen.getAllByText('/alpha')).toHaveLength(1);
  expect(screen.queryByText('Сообщество готово')).not.toBeInTheDocument();
});
