import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@gravity-ui/uikit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { portalMessages } from '../../../shared/i18n/messages';
import { DashboardPage } from './Page';
import { useState, type ReactNode } from 'react';
vi.mock('@/shared/hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

const state = vi.hoisted(() => ({
  updateLayout: vi.fn(),
  updateWidget: vi.fn(),
  createWidget: vi.fn(),
  createLayout: vi.fn(),
  deleteWidget: vi.fn(),
  add: vi.fn(),
  layouts: [
    {
      id: 'layout',
      layout_name: 'My dashboard',
      layout_config: {},
      is_default: true,
    },
  ],
  widgets: [
    'overview-hero',
    'upcoming-events',
    'active-polls',
    'activity-feed',
  ].map((key, index) => ({
    id: key,
    widget_key: key,
    is_visible: true,
    settings: {},
    position_x: 0,
    position_y: index * 3,
    width: 12,
    height: 3,
  })),
}));
vi.mock('../../../features/personalization/hooks/useDashboards', () => ({
  useDashboards: () => ({
    layouts: state.layouts,
    isForbidden: false,
    createLayout: state.createLayout,
    updateLayout: state.updateLayout,
  }),
  useDashboardWidgets: () => ({
    widgets: state.widgets,
    createWidget: state.createWidget,
    updateWidget: state.updateWidget,
    deleteWidget: state.deleteWidget,
  }),
}));
vi.mock('../../../shared/i18n/usePortalI18n', () => ({
  usePortalI18n: () => ({
    t: (path: string) =>
      path
        .split('.')
        .reduce<unknown>(
          (value, key) => (value as Record<string, unknown>)[key],
          portalMessages.en,
        ),
  }),
}));
vi.mock('@gravity-ui/uikit', async () => ({
  ...(await vi.importActual('@gravity-ui/uikit')),
  useToaster: () => ({ add: state.add }),
  // Gravity's scoped focus selectors are unsupported by jsdom. Real menu/focus behavior is tested in Playwright.
  DropdownMenu: ({
    items,
    renderSwitcher,
  }: {
    items: { text: string; disabled?: boolean; action: () => void }[];
    renderSwitcher: (props: { onClick: () => void }) => ReactNode;
  }) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        {renderSwitcher({ onClick: () => setOpen(!open) })}
        {open &&
          items.map((item) => (
            <button
              key={item.text}
              disabled={item.disabled}
              onClick={() => {
                item.action();
                setOpen(false);
              }}
            >
              {item.text}
            </button>
          ))}
      </>
    );
  },
}));
vi.mock('./ui/CommunityWidget', () => ({
  CommunityWidget: () => <div>Section content</div>,
}));
vi.mock('./ui/DashboardHero', () => ({
  DashboardHero: () => <div>Community content</div>,
}));

function setup(width = 390) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  render(
    <ThemeProvider theme="dark">
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
  return userEvent.setup();
}
async function edit(width = 390) {
  const user = setup(width);
  await user.click(screen.getByRole('button', { name: 'Customize dashboard' }));
  return user;
}
const rows = () =>
  within(screen.getByRole('list', { name: 'Overview sections' })).getAllByRole(
    'listitem',
  );

describe('dashboard editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.updateLayout.mockResolvedValue({});
    state.updateWidget.mockResolvedValue({});
  });
  it('uses a compact mobile list without a desktop canvas or Done editing label', async () => {
    await edit();
    expect(
      screen.getByRole('heading', { name: 'Edit overview' }),
    ).toBeInTheDocument();
    expect(rows()).toHaveLength(4);
    expect(screen.queryByText('Done editing')).not.toBeInTheDocument();
    expect(screen.queryByText('My dashboard')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Desktop' }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('.dashboard-grid--editing')).toBeNull();
    expect(
      screen.getByRole('region', { name: 'Editing actions' }),
    ).toContainElement(
      screen.getByRole('button', { name: 'Save', exact: true }),
    );
  });
  it('moves a section past its adjacent section, without changing desktop positions', async () => {
    const user = await edit();
    const firstTitle = within(rows()[0]).getByRole('heading').textContent;
    await user.click(
      within(rows()[0]).getByRole('button', { name: /Section actions/ }),
    );
    await user.click(screen.getByText('Move down', { exact: true }));
    expect(within(rows()[1]).getByRole('heading')).toHaveTextContent(
      firstTitle!,
    );
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
    await waitFor(() => expect(state.updateLayout).toHaveBeenCalledOnce());
    const config = state.updateLayout.mock.calls[0][1].layout_config;
    expect(config.breakpoints.mobile.items['overview-hero'].y).toBeGreaterThan(
      config.breakpoints.mobile.items['activity-feed'].y,
    );
    expect(config.breakpoints.desktop.items['overview-hero']).toEqual({
      x: 0,
      y: 0,
      w: 12,
      h: 3,
    });
  });
  it('cancel restores visibility and does not persist draft changes', async () => {
    const user = await edit();
    await user.click(within(rows()[0]).getByRole('switch'));
    expect(within(rows()[0]).getByRole('switch')).not.toBeChecked();
    await user.click(
      screen.getByRole('button', { name: 'Cancel', exact: true }),
    );
    expect(state.updateWidget).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: 'Customize dashboard' }),
    );
    expect(within(rows()[0]).getByRole('switch')).toBeChecked();
  });
  it('locks controls during save, retains the draft on error and allows recovery', async () => {
    let rejectSave!: (error: Error) => void;
    state.updateWidget.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject;
        }),
    );
    const user = await edit();
    await user.click(within(rows()[0]).getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
    expect(
      screen.getByRole('button', { name: 'Cancel', exact: true }),
    ).toBeDisabled();
    expect(within(rows()[0]).getByRole('switch')).toBeDisabled();
    await act(async () => rejectSave(new Error('Unavailable')));
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to save');
    expect(within(rows()[0]).getByRole('switch')).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Edit overview' }),
      ).not.toBeInTheDocument(),
    );
    expect(state.updateLayout).toHaveBeenCalledOnce();
  });
  it('keeps the grid and breakpoint controls on desktop', async () => {
    await edit(1280);
    expect(screen.getByRole('button', { name: 'Desktop' })).toBeInTheDocument();
    expect(document.querySelector('.dashboard-grid--editing')).not.toBeNull();
    expect(screen.queryByText('Done editing')).not.toBeInTheDocument();
  });
});
