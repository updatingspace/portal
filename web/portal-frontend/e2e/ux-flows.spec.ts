import { expect, test } from '@playwright/test';

import { memberships, locale, session } from './fixtures/portal';

for (const width of [360, 390, 768, 1280])
  for (const theme of ['light', 'dark'] as const) {
    test(`member screens ${theme} ${width} retain navigation without overflow`, async ({
      page,
    }) => {
      test.setTimeout(90000);
      await session(page);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      for (const route of [
        '',
        'feed',
        'events',
        'events/event-1',
        'voting',
        'gamification',
        'profile',
        'settings',
      ]) {
        await page.goto(`/t/alpha${route ? `/${route}` : ''}`);
        await expect(page.locator('#main-content')).toBeVisible();
        await expect(page.locator('#main-content .app-loader')).toHaveCount(0);
        await expect(page.locator('#main-content')).not.toBeEmpty();
        const overflow = await page.locator('#main-content').evaluate((root) =>
          [...root.querySelectorAll('*')]
            .filter(
              (element) =>
                element.getBoundingClientRect().right > innerWidth + 1,
            )
            .slice(0, 6)
            .map((element) => element.className),
        );
        expect.soft(overflow, route || 'overview').toEqual([]);
        await page.screenshot({
          path: `/tmp/portal-ux-review/member-${route.replaceAll('/', '-') || 'overview'}-${theme}-${width}.png`,
        });
      }
      expect(errors).toEqual([]);
    });
  }

test('public home stays usable while the session service fails; login works on an IP', async ({
  page,
}) => {
  await locale(page);
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: 'UNAVAILABLE', message: 'Unavailable' } },
    }),
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Ваше сообщество. Следующий уровень.' }),
  ).toBeVisible();
  await expect(page.locator('a[href*="demo-token"]')).toHaveCount(0);
  await page.goto('/login?next=%2Ft%2Falpha%2Fevents%3Fperiod%3Dpast%23event');
  await expect(
    page.getByRole('heading', { name: 'Вход в UpdSpace' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('no membership offers both paths and validates a community application', async ({
  page,
}) => {
  await session(page, true);
  await page.goto('/choose-tenant');
  await expect(
    page.getByRole('heading', { name: 'Присоединиться по приглашению' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Создать сообщество' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Подать заявку' }).click();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByText('Введите название')).toBeVisible();
  await page.getByLabel('Название', { exact: true }).fill('Моя команда');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await page.getByLabel('Адрес сообщества', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByText('Этот адрес зарезервирован')).toBeVisible();
});

test('switching community verifies the session and sends expected context on data requests', async ({
  page,
}) => {
  await session(page);
  const contexts: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/events/events/')
      contexts.push(request.headers()['x-portal-expected-tenant']);
  });
  await page.goto('/t/alpha/events');
  await expect(page.getByText('Альфа: встреча')).toBeVisible();
  await page.goto('/t/beta/events');
  await expect(page.getByText('Бета: встреча')).toBeVisible();
  await expect(page.getByText('Альфа: встреча')).toHaveCount(0);
  expect(contexts).toContain('alpha');
  expect(contexts).toContain('beta');
});

for (const width of [390, 1280])
  for (const theme of ['light', 'dark'] as const) {
    test(`public layout ${theme} ${width}`, async ({ page }) => {
      await locale(page);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.route('**/api/v1/**', (route) =>
        route.fulfill({
          status: 401,
          json: { error: { code: 'UNAUTHENTICATED' } },
        }),
      );
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/portal-ux-review/public-${theme}-${width}.png`,
        fullPage: true,
      });
    });
  }

test('event form retains input on failure and protects navigation', async ({
  page,
}) => {
  await session(page, false, true);
  let writes = 0;
  await page.route('**/api/v1/events/events/', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    writes++;
    await route.fulfill({
      status: 503,
      json: { error: { code: 'UNAVAILABLE', message: 'Unavailable' } },
    });
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/t/alpha/events/create');
  await page.getByLabel('Название', { exact: true }).fill('Новый рейд');
  await page
    .getByRole('button', { name: 'Создать событие', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Не удалось подтвердить сохранение',
  );
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue(
    'Новый рейд',
  );
  expect(writes).toBe(1);
  await page.screenshot({
    path: '/tmp/portal-ux-review/event-create-error-390.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Есть несохранённые изменения',
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Отмена' })
    .click();
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue(
    'Новый рейд',
  );
});

test('mobile navigation is a dismissible menu and community selection lives beside the account', async ({
  page,
}) => {
  await session(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/t/alpha/feed');
  await expect(page.locator('.portal-mobile-nav')).toHaveCount(0);
  await expect(page.locator('header').getByRole('combobox')).toHaveCount(0);
  const menu = page.getByRole('button', { name: 'Открыть меню разделов' });
  await menu.click();
  await expect(page.getByRole('dialog', { name: 'Разделы' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await menu.click();
  await page
    .getByRole('dialog')
    .getByRole('link', { name: 'Голосования', exact: true })
    .click();
  await expect(page).toHaveURL(/voting$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Меню аккаунта Игрок' }).click();
  await page.getByText('Сменить сообщество', { exact: true }).click();
  await expect(page).toHaveURL(/choose-tenant$/);
  await page
    .getByRole('article')
    .filter({ hasText: 'Бета' })
    .getByRole('button', { name: 'Открыть' })
    .click();
  await expect(page).toHaveURL(/\/t\/beta\/?$/);
});

test('mobile feed offers compact filters and an explicit publication action', async ({
  page,
}) => {
  await session(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/t/alpha/feed');
  await expect(page.getByLabel('Текст новости')).toHaveCount(0);
  await page.getByRole('button', { name: 'Написать публикацию' }).click();
  await page.getByLabel('Текст новости').fill('Сохранить мой текст');
  await expect(
    page.getByRole('button', { name: 'Опубликовать в сообществе' }),
  ).toContainText('Опубликовать');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Сортировка', { exact: true })).not.toBeVisible();
  await page
    .getByRole('button', { name: 'Фильтры ленты', exact: true })
    .click();
  await expect(page.getByText('Сортировка', { exact: true })).toBeVisible();
  await page.screenshot({
    path: '/tmp/portal-ux-review/mobile-feed-editor.png',
  });
});

for (const theme of ['light', 'dark'] as const)
  test(`mobile settings tabs with loaded data ${theme}`, async ({ page }) => {
    await session(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/v1/personalization/preferences**', (route) =>
      route.fulfill({
        json: {
          id: 'prefs',
          user_id: '11111111-1111-4111-8111-111111111111',
          tenant_id: memberships[0].tenant_id,
          appearance: {
            theme,
            theme_source: 'portal',
            accent_color: '#7557F5',
            font_size: 'medium',
            high_contrast: false,
            reduce_motion: true,
          },
          localization: { language: 'ru', timezone: 'Europe/Moscow' },
          notifications: {
            email: { enabled: true, digest: 'daily' },
            in_app: { enabled: true },
            push: { enabled: false },
            types: {},
            quiet_hours: { enabled: false, start: '22:00', end: '08:00' },
          },
          privacy: {
            profile_visibility: 'members',
            show_online_status: true,
            show_vote_history: false,
            share_activity: true,
            allow_mentions: true,
            analytics_enabled: false,
            recommendations_enabled: false,
          },
          created_at: '2026-09-30T00:00:00Z',
          updated_at: '2026-09-30T00:00:00Z',
        },
      }),
    );
    await page.goto('/t/alpha/settings');
    await page.getByRole('link', { name: 'Внешний вид', exact: true }).click();
    await expect(page.getByTestId('theme-option-dark')).toBeVisible();
    await page.screenshot({
      path: `/tmp/portal-ux-review/mobile-settings-loaded-${theme}.png`,
    });
    await page.getByRole('link', { name: 'Все настройки' }).click();
    await page.getByRole('link', { name: 'Приватность', exact: true }).click();
    await expect(page).toHaveURL(/tab=privacy/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole('link', { name: 'Все настройки' }).click();
    await page.getByRole('link', { name: 'Сообщество', exact: true }).click();
    await page
      .getByRole('button', { name: 'Сменить сообщество', exact: true })
      .click();
    await expect(page).toHaveURL(/choose-tenant$/);
  });
