import { expect, test, type Page } from '@playwright/test';
import { extendedSession, auditUser } from './fixtures/extended';
import { memberships } from './fixtures/portal';

test.describe.configure({ mode: 'parallel' });

async function setup(
  page: Page,
  language: 'ru' | 'en' = 'en',
  initialEmpty = false,
) {
  await extendedSession(page);
  await page.addInitScript(
    (locale) => localStorage.setItem('portal_locale_v1', locale),
    language,
  );
  await page.route('**/api/v1/session/me', (route) =>
    route.fulfill({
      json: {
        user: { id: auditUser, language, master_flags: { system_admin: true } },
        tenant: { id: memberships[0].tenant_id, slug: 'alpha' },
        portal_profile: { display_name: 'Player', language },
      },
    }),
  );
  let layout = {
    id: 'layout',
    layout_name: 'My dashboard',
    is_default: true,
    layout_config: {},
  };
  let widgets = [
    'overview-hero',
    'upcoming-events',
    'active-polls',
    'activity-feed',
  ].map((key, index) => ({
    id: key,
    layout_id: 'layout',
    widget_key: key,
    is_visible: true,
    settings: {},
    position_x: 0,
    position_y: index * 3,
    width: 12,
    height: 2,
  }));
  let hasLayout = !initialEmpty;
  if (initialEmpty) widgets = [];
  const writes: string[] = [];
  await page.route(
    '**/api/v1/personalization/admin/dashboards/**',
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const id = path.split('/').at(-1)!;
      if (request.method() === 'GET') {
        await route.fulfill({
          json: path.includes('/widgets') ? widgets : hasLayout ? [layout] : [],
        });
        return;
      }
      writes.push(path);
      if (path.endsWith('/layouts/layout') || path.endsWith('/layouts')) {
        hasLayout = true;
        layout = { ...layout, ...request.postDataJSON() };
        await route.fulfill({ json: layout });
      } else if (path.includes('/widgets/')) {
        if (request.method() === 'DELETE')
          widgets = widgets.filter((widget) => widget.id !== id);
        else
          widgets = widgets.map((widget) =>
            widget.id === id
              ? { ...widget, ...request.postDataJSON() }
              : widget,
          );
        await route.fulfill({
          json: widgets.find((widget) => widget.id === id) ?? { success: true },
        });
      } else {
        const widget = {
          id: `added-${widgets.length}`,
          ...request.postDataJSON(),
        };
        widgets.push(widget);
        await route.fulfill({ json: widget });
      }
    },
  );
  return { writes };
}

for (const width of [360, 390, 1280]) {
  for (const language of ['en', 'ru'] as const) {
    test(`overview editor ${width} ${language}`, async ({ page }, info) => {
      await setup(page, language);
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({
        colorScheme: language === 'en' ? 'dark' : 'light',
        reducedMotion: 'reduce',
      });
      const t = (ru: string, en: string) => (language === 'ru' ? ru : en);
      await page.goto('/t/alpha');
      await page
        .getByRole('button', {
          name: t('Настроить обзор', 'Customize dashboard'),
        })
        .click();
      await expect(
        page.getByRole('heading', {
          name: t('Настроить обзор', 'Edit overview'),
        }),
      ).toBeFocused();
      await expect(page.getByText('Done editing', { exact: true })).toHaveCount(
        0,
      );
      await expect(page.getByText('My dashboard', { exact: true })).toHaveCount(
        0,
      );
      const footer = page.getByRole('region', {
        name: t('Сохранение изменений', 'Editing actions'),
      });
      for (const name of [t('Отмена', 'Cancel'), t('Сохранить', 'Save')]) {
        const button = footer.getByRole('button', { name, exact: true });
        const bounds = (await button.boundingBox())!;
        const label = (await button.locator('.g-button__text').boundingBox())!;
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(
          Math.abs(bounds.y + bounds.height / 2 - label.y - label.height / 2),
        ).toBeLessThanOrEqual(1);
      }
      if (width < 720) {
        const list = page.getByRole('list', {
          name: t('Разделы обзора', 'Overview sections'),
        });
        await expect(list.getByRole('listitem')).toHaveCount(4);
        await expect(
          page.getByRole('button', {
            name: t('Десктоп', 'Desktop'),
            exact: true,
          }),
        ).toHaveCount(0);
        expect((await list.boundingBox())!.height).toBeLessThan(420);
        const footerBox = (await footer.boundingBox())!;
        expect(footerBox.y + footerBox.height).toBe(844);
        expect(
          (await list.boundingBox())!.y + (await list.boundingBox())!.height,
        ).toBeLessThan(footerBox.y);
        const menu = list
          .getByRole('button', {
            name: new RegExp(t('Действия с разделом', 'Section actions')),
          })
          .first();
        await menu.click();
        await expect(
          page.getByText(t('Ниже', 'Move down'), { exact: true }),
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menu).toBeFocused();
        await page.screenshot({
          path: info.outputPath('editor.png'),
          fullPage: true,
        });
        await page.setViewportSize({ width, height: 500 });
        await list.getByRole('listitem').last().scrollIntoViewIfNeeded();
        const last = (await list.getByRole('listitem').last().boundingBox())!;
        const sticky = (await footer.boundingBox())!;
        // A control scrolled into view must not be covered by the action bar.
        await page.mouse.wheel(0, 200);
        expect(last.height).toBeLessThan(110);
        expect(sticky.y + sticky.height).toBe(500);
      } else {
        await expect(
          page.getByRole('button', {
            name: t('Десктоп', 'Desktop'),
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', {
            name: t('Десктоп', 'Desktop'),
            exact: true,
          }),
        ).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.dashboard-grid--editing')).toBeVisible();
        await page.screenshot({
          path: info.outputPath('editor.png'),
          fullPage: true,
        });
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await footer
        .getByRole('button', { name: t('Отмена', 'Cancel'), exact: true })
        .click();
      await expect(
        page.getByRole('button', {
          name: t('Настроить обзор', 'Customize dashboard'),
        }),
      ).toBeFocused();
    });
  }
}

test('mobile edits survive a failed save, prevent duplicate submission, and persist after reload', async ({
  page,
}, info) => {
  const { writes } = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/t/alpha');
  await page.getByRole('button', { name: 'Customize dashboard' }).click();
  const list = page.getByRole('list', { name: 'Overview sections' });
  const first = list.getByRole('listitem').first();
  await first.getByRole('button', { name: /Section actions/ }).click();
  await page.getByText('Move down', { exact: true }).click();
  await expect(
    list.getByRole('listitem').nth(1).getByRole('heading'),
  ).toHaveText('Community');
  await list.getByRole('switch', { name: 'Activity feed' }).uncheck();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  await page.route('**/dashboards/widgets/activity-feed', async (route) => {
    if (route.request().method() === 'PUT' && attempts++ === 0) {
      await gate;
      await route.fulfill({
        status: 503,
        json: { error: { code: 'UNAVAILABLE', message: 'Unavailable' } },
      });
    } else await route.fallback();
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeDisabled();
  await expect(list.getByRole('switch').first()).toBeDisabled();
  release();
  const error = page.locator('.dashboard-editor-footer').getByRole('alert');
  await expect(error).toContainText('Failed to save');
  expect(attempts).toBe(1);
  await expect(
    list.getByRole('switch', { name: 'Activity feed' }),
  ).not.toBeChecked();
  await page.screenshot({
    path: info.outputPath('save-error.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Customize dashboard' }),
  ).toBeVisible();
  expect(
    writes.filter((path) => path.endsWith('/layouts/layout')),
  ).toHaveLength(1);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Activity feed', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Customize dashboard' }).click();
  await expect(
    list.getByRole('listitem').nth(1).getByRole('heading'),
  ).toHaveText('Community');
  await expect(
    list.getByRole('switch', { name: 'Activity feed' }),
  ).not.toBeChecked();
});

test('section removal, re-addition and reset confirmation remain draft-only until save', async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/t/alpha');
  await page.getByRole('button', { name: 'Customize dashboard' }).click();
  const list = page.getByRole('list', { name: 'Overview sections' });
  await list
    .getByRole('button', { name: 'Section actions: Community', exact: true })
    .click();
  await page.getByText('Remove', { exact: true }).click();
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await page.getByRole('button', { name: 'Add section' }).click();
  await page.getByText('Community', { exact: true }).click();
  await expect(list.getByRole('listitem')).toHaveCount(4);
  await page.getByRole('button', { name: 'Layout options' }).click();
  await page.getByText('Reset layout', { exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Layout options' }),
  ).toBeFocused();
  await list.getByRole('switch').first().uncheck();
  await page.getByRole('button', { name: 'Layout options' }).click();
  await page.getByText('Reset layout', { exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Reset layout', exact: true })
    .click();
  await expect(
    list.getByRole('listitem').first().getByRole('heading'),
  ).toHaveText('Community');
  await expect(list.getByRole('switch').first()).toBeChecked();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(writes).toEqual([]);
});

test('first customization creates one layout and retains confirmed sections after a later write fails', async ({
  page,
}) => {
  const { writes } = await setup(page, 'en', true);
  await page.setViewportSize({ width: 390, height: 844 });
  let failUpdate = true;
  await page.route('**/dashboards/widgets/*', async (route) => {
    if (route.request().method() === 'PUT' && failUpdate) {
      failUpdate = false;
      await route.fulfill({
        status: 503,
        json: { error: { code: 'UNAVAILABLE', message: 'Unavailable' } },
      });
    } else await route.fallback();
  });
  await page.goto('/t/alpha');
  await page.getByRole('button', { name: 'Customize dashboard' }).click();
  const list = page.getByRole('list', { name: 'Overview sections' });
  await list.getByRole('switch', { name: 'Activity feed' }).uncheck();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.locator('.dashboard-editor-footer').getByRole('alert'),
  ).toBeVisible();
  await expect(
    list.getByRole('switch', { name: 'Activity feed' }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Customize dashboard' }),
  ).toBeVisible();
  expect(writes.filter((path) => path.endsWith('/layouts'))).toHaveLength(1);
  expect(
    writes.filter((path) => path.endsWith('/layouts/layout/widgets')),
  ).toHaveLength(4);
  await page.reload();
  await page.getByRole('button', { name: 'Customize dashboard' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(4);
  await expect(
    list.getByRole('switch', { name: 'Activity feed' }),
  ).not.toBeChecked();
});
