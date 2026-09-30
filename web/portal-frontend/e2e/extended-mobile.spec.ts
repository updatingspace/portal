import { expect, test } from '@playwright/test';
import { extendedSession } from './fixtures/extended';

test.beforeEach(async ({ page }) => {
  await extendedSession(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
});

test('audit remaining routes with populated data', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const route of [
    '',
    'events',
    'events/event-1',
    'events/create',
    'voting/create',
    'voting/templates',
    'voting/poll-1',
    'voting/poll-1/manage',
    'voting/poll-1/results',
    'voting/analytics',
    'gamification',
    'gamification/achievements/award-1',
    'gamification/achievements/new',
    'feature-flags',
    'tenant-admin',
    'admin',
    'profile/achievements',
    'profile/communities',
  ]) {
    await page.goto(`/t/alpha/${route}`);
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('#main-content .app-loader')).toHaveCount(0);
    await page.screenshot({
      path: `/tmp/portal-extended-review/${route.replaceAll('/', '-') || 'overview'}-390.png`,
      fullPage: true,
    });
    expect
      .soft(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        route,
      )
      .toBe(true);
  }
  expect(errors).toEqual([]);
});

test('events separates calendar and filters from reading the list', async ({
  page,
}) => {
  await page.goto('/t/alpha/events');
  await expect(
    page.getByRole('heading', { name: 'События', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.portal-events-calendar')).not.toBeVisible();
  await page.getByRole('button', { name: 'Календарь', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Календарь' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Фильтры событий', exact: true })
    .click();
  await expect(
    page.getByRole('dialog').getByLabel('Поиск событий'),
  ).toBeVisible();
});

test('poll creation starts with an editable form, not a promotional page', async ({
  page,
}) => {
  await page.goto('/t/alpha/voting/create');
  await expect(
    page.getByRole('textbox', { name: 'Название *', exact: true }),
  ).toBeInViewport();
  await expect(page.getByText('Как это работает', { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole('textbox', { name: 'Название *', exact: true })
    .fill('Локальный черновик');
  await page.getByRole('button', { name: 'Выбрать шаблон' }).click();
  await page.getByRole('button', { name: 'Пустой опрос' }).click();
  const confirmation = page.getByRole('dialog', {
    name: 'Подтвердите действие',
  });
  await expect(confirmation).toBeVisible();
  await confirmation
    .getByRole('button', { name: 'Подтвердить', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Название *', exact: true }),
  ).toHaveValue('');
});

test('achievement management starts with the catalog and grants open on demand', async ({
  page,
}) => {
  await page.goto('/t/alpha/gamification');
  await expect(
    page.getByRole('heading', { name: 'Вместе до победы' }),
  ).toBeInViewport();
  await expect(page.getByText('Базовые сценарии работы')).toHaveCount(0);
  await page.goto('/t/alpha/gamification/achievements/award-1');
  await expect(
    page.getByRole('heading', { name: 'Вместе до победы', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Выдать награду', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Выдать награду' }),
  ).toBeVisible();
});

test('secondary form sections fit a phone and keep readable controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/t/alpha/voting/create');
  await page
    .getByRole('textbox', { name: 'Название *', exact: true })
    .fill('Вечер игр');
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  for (const control of await page.getByRole('combobox').all()) {
    // Gravity draws the interactive border with a pseudo-element across its control wrapper.
    const height = await control.evaluate(
      (element) =>
        element.closest('.g-select-control')!.getBoundingClientRect().height,
    );
    expect(height).toBeGreaterThanOrEqual(44);
  }
  await expect(
    page.getByText('ID области (необязательно)', { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: '/tmp/portal-extended-review/poll-rules-360.png',
    fullPage: true,
  });
  await page.goto('/t/alpha/gamification/achievements/new');
  await page.getByText('Дополнительно', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Добавить язык', exact: true })
    .click();
  await page.getByLabel('Язык 2', { exact: true }).fill('en');
  await page
    .getByLabel('Название на языке en', { exact: true })
    .fill('A very long achievement title');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  const skipLink = page.getByRole('link', { name: 'К содержимому' });
  // An unfocused fixed link must not appear halfway down a full-page capture after scrolling.
  await expect(skipLink).toHaveCSS('opacity', '0');
  await page.screenshot({
    path: '/tmp/portal-extended-review/award-translations-360.png',
    fullPage: true,
  });
  await skipLink.focus();
  await expect(skipLink).toHaveCSS('opacity', '1');
  await expect(skipLink).toBeInViewport();
  await skipLink.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('feature flags open creation as a separate task', async ({ page }) => {
  await page.goto('/t/alpha/feature-flags');
  await expect(
    page.getByRole('heading', { name: 'Функции платформы', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Ключ', { exact: true })).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Новая функция', exact: true })
    .click();
  await expect(
    page.getByRole('dialog').getByLabel('Ключ', { exact: true }),
  ).toBeVisible();
});

test('secondary action menus have meaningful names and touch targets', async ({
  page,
}) => {
  for (const [path, name, action] of [
    ['events/event-1', 'Действия с событием', 'Скопировать ссылку'],
    ['voting/poll-1/manage', 'Действия с опросом', 'Закрыть голосование'],
    ['voting/poll-1/results', 'Действия с результатами', 'Скачать CSV'],
    [
      'gamification',
      'Действия с достижением «Вместе до победы»',
      'Редактировать',
    ],
  ]) {
    await page.goto(`/t/alpha/${path}`);
    const trigger = page.getByRole('button', { name, exact: true });
    await expect(trigger).toBeVisible();
    const box = await trigger.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await trigger.click();
    await expect(page.getByText(action, { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }
});

test('results show a tie without declaring a winner and render real bars', async ({
  page,
}) => {
  await page.goto('/t/alpha/voting/poll-1/results');
  await expect(
    page.getByText('У лидирующих вариантов равное число голосов.'),
  ).toBeVisible();
  await expect(page.getByText('Всего голосов: 4')).toBeVisible();
  await expect(page.getByRole('meter')).toHaveCount(2);
  for (const bar of await page.locator('.voting-v2__chart-fill').all()) {
    expect(
      await bar.evaluate(
        (element) => getComputedStyle(element).backgroundImage,
      ),
    ).not.toBe('none');
    expect((await bar.boundingBox())!.width).toBeGreaterThan(100);
  }
});

test('role details open as a focused task and return focus to the role', async ({
  page,
}) => {
  await page.goto('/t/alpha/tenant-admin');
  const role = page.getByRole('button', { name: /Организатор встреч/ });
  await expect(role).toBeInViewport();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await role.click();
  await expect(
    page.getByRole('dialog', { name: 'Организатор встреч' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(role).toBeFocused();
});

test('all four administration sections fit the mobile navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/t/alpha/tenant-admin?tab=audit');
  const sections = page.getByRole('group', {
    name: 'Управление сообществом',
    exact: true,
  });
  for (const name of ['Роли', 'Участники', 'Права', 'Аудит']) {
    await expect(
      sections.getByRole('button', { name, exact: true }),
    ).toBeInViewport({ ratio: 1 });
  }
  await expect(
    page.getByRole('button', { name: 'Обновить', exact: true }),
  ).toHaveCount(1);
  await sections
    .getByRole('button', { name: 'Участники', exact: true })
    .click();
  await expect(
    page.getByText('Состав сообщества', { exact: true }),
  ).toHaveCount(0);
});

test('award form keeps entered values after a failed save', async ({
  page,
}) => {
  await page.route('**/api/v1/gamification/achievements', async (route) => {
    if (route.request().method() === 'POST')
      await route.fulfill({
        status: 503,
        json: { error: { code: 'UNAVAILABLE', message: 'Unavailable' } },
      });
    else await route.fallback();
  });
  await page.goto('/t/alpha/gamification/achievements/new');
  await page.getByLabel('Название', { exact: true }).fill('Помощь команде');
  await page
    .getByLabel('Описание', { exact: true })
    .fill('Спасибо за организацию встречи');
  await page.getByRole('combobox', { name: 'Категория', exact: true }).click();
  await page.getByRole('option', { name: 'Командная игра' }).click();
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Не удалось сохранить');
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue(
    'Помощь команде',
  );
  await expect(page.getByLabel('Описание', { exact: true })).toHaveValue(
    'Спасибо за организацию встречи',
  );
});

for (const width of [360, 768, 1280])
  for (const theme of ['light', 'dark'] as const) {
    test(`remaining sections fit ${width}px in ${theme}`, async ({ page }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      for (const route of [
        'events',
        'events/create',
        'voting/create',
        'voting/poll-1/manage',
        'voting/poll-1/results',
        'gamification',
        'gamification/achievements/new',
        'tenant-admin',
        'tenant-admin?tab=members',
        'tenant-admin?tab=permissions',
        'tenant-admin?tab=audit',
      ]) {
        await page.goto(`/t/alpha/${route}`);
        await expect(page.locator('#main-content h1')).toBeVisible();
        await expect(page.locator('#main-content .app-loader')).toHaveCount(0);
        expect
          .soft(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            route,
          )
          .toBe(true);
        if (
          [
            'events/create',
            'voting/create',
            'voting/poll-1/manage',
            'gamification/achievements/new',
          ].includes(route)
        ) {
          const inputs = page.locator(
            '#main-content input:not([type=checkbox]):not([type=radio]):visible',
          );
          for (const input of await inputs.all()) {
            const bounds = await input.boundingBox();
            expect
              .soft(bounds!.width, `${route}: field width`)
              .toBeGreaterThan(width < 720 ? 180 : 140);
            expect
              .soft(bounds!.height, `${route}: field height`)
              .toBeGreaterThanOrEqual(40);
          }
        }
        if (width === 360 || width === 1280)
          await page.screenshot({
            path: `/tmp/portal-extended-review/${route.replaceAll('/', '-').replace('?', '-')}-${width}-${theme}.png`,
            fullPage: true,
          });
      }
    });
  }

test('profile lists have real navigation and no placeholder panels or raw statuses', async ({
  page,
}) => {
  await page.goto('/t/alpha/profile/achievements');
  await expect(
    page.getByRole('heading', { name: 'Мои награды' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Вместе до победы/ }),
  ).toHaveAttribute('href', '/t/alpha/gamification/achievements/award-1');
  await expect(
    page.getByText(/следующей итерации|published|teamwork/),
  ).toHaveCount(0);
  await page.goto('/t/alpha/profile/communities');
  await expect(page.getByRole('link', { name: /Бета/ })).toHaveAttribute(
    'href',
    '/t/beta',
  );
  await expect(page.getByText('Текущее сообщество')).toBeVisible();
});

test('question editor keeps remaining options after deleting the first', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/v1/voting/polls/poll-1/info', (route) =>
    route.fulfill({
      json: {
        poll: {
          id: 'poll-1',
          title: 'Черновик',
          status: 'draft',
          scope_type: 'TENANT',
          scope_id: '00000000-0000-4000-8000-000000000000',
          visibility: 'public',
          results_visibility: 'always',
          settings: {},
        },
        nominations: [],
        options: [],
        meta: { can_vote: false, has_voted: false },
      },
    }),
  );
  await page.goto('/t/alpha/voting/poll-1/manage?tab=questions');
  await page
    .getByRole('button', { name: 'Добавить вопрос', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Новый вопрос' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Название вопроса').fill('Выбираем игру');
  await dialog.getByRole('button', { name: 'Добавить первый вариант' }).click();
  await dialog
    .getByLabel('Название варианта', { exact: true })
    .fill('Minecraft');
  await dialog
    .getByRole('button', { name: 'Добавить вариант', exact: true })
    .click();
  await dialog
    .getByLabel('Название варианта', { exact: true })
    .nth(1)
    .fill('Deep Rock Galactic');
  await dialog
    .getByRole('button', { name: 'Удалить', exact: true })
    .first()
    .click();
  await expect(
    dialog.getByLabel('Название варианта', { exact: true }),
  ).toHaveValue('Deep Rock Galactic');
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  for (const width of [360, 768, 1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await expect(
      dialog.getByLabel('Название варианта', { exact: true }),
    ).toHaveValue('Deep Rock Galactic');
  }
  await page.screenshot({
    path: '/tmp/portal-extended-review/question-editor-390.png',
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('poll participant selection uses names and keeps input after rejection', async ({
  page,
}) => {
  await page.route(
    '**/api/v1/voting/polls/poll-1/participants',
    async (route) => {
      if (route.request().method() === 'POST')
        await route.fulfill({
          status: 409,
          json: {
            error: { code: 'CONFLICT', message: 'Участник уже добавлен' },
          },
        });
      else await route.fulfill({ json: [] });
    },
  );
  await page.goto('/t/alpha/voting/poll-1/manage?tab=participants');
  await page.getByLabel('Участник', { exact: true }).fill('Игрок');
  await page
    .getByRole('button', { name: 'Игрок @player', exact: true })
    .click();
  await expect(page.getByText('Выбран: Игрок')).toBeVisible();
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Не удалось добавить участника',
  );
  await expect(page.getByLabel('Участник', { exact: true })).toHaveValue(
    'Игрок',
  );
  await page.screenshot({
    path: '/tmp/portal-extended-review/poll-participants-390.png',
    fullPage: true,
  });
});
