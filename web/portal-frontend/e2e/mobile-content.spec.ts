import { expect, test, type Page } from '@playwright/test';
import { memberships, session } from './fixtures/portal';

async function loadedPreferences(page: Page, theme: 'light' | 'dark') {
  const preferences = {
    id: 'prefs',
    user_id: uid,
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
  };
  await page.route('**/api/v1/personalization/preferences**', (route) =>
    route.fulfill({ json: preferences }),
  );
}

const uid = '11111111-1111-4111-8111-111111111111';
const post = {
  id: 1,
  tenant_id: memberships[0].tenant_id,
  actor_user_id: uid,
  target_user_id: null,
  type: 'news.posted',
  occurred_at: '2026-09-30T09:00:00Z',
  title: 'Встречаемся в пятницу',
  payload_json: {
    news_id: 'news-1',
    body: 'Собираем команду на пятничный вечер. Начинаем в 20:00 — присоединяйтесь!',
    tags: [],
    media: [],
    status: 'published',
    comments_count: 3,
    reactions_count: 2,
    views_count: 12,
    reaction_counts: [{ emoji: '🔥', count: 2, my_reacted: false }],
    my_reactions: [],
  },
  visibility: 'public',
  scope_type: 'TENANT',
  scope_id: memberships[0].tenant_id,
  source_ref: 'news-1',
};
async function setup(page: Page, populated = false) {
  await session(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/activity/news/news-1/views', (route) =>
    route.fulfill({ json: { views_count: 13 } }),
  );
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.route('**/api/v1/activity/v2/feed**', (route) =>
    route.fulfill({
      json: {
        items: populated ? [post] : [],
        has_more: false,
        next_cursor: null,
      },
    }),
  );
}

test('profile starts with identity and one writing action; details and composer open on demand', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/t/alpha/profile');
  await expect(
    page.getByRole('heading', { name: 'Игрок', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByText('Пока нет достижений')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Посты', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Написать публикацию' }),
  ).toHaveCount(1);
  await page.screenshot({
    path: '/tmp/portal-mobile-review/profile-empty-dark-390.png',
  });
  const details = page.getByRole('button', { name: 'О профиле', exact: true });
  await details.click();
  await expect(page.getByRole('dialog', { name: 'О профиле' })).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'Мои достижения' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(details).toBeFocused();
  await page.getByRole('button', { name: 'Написать публикацию' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая публикация' });
  await dialog.getByRole('textbox').fill('Черновик остаётся со мной');
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('button', { name: 'Написать публикацию' }).click();
  await expect(dialog.getByRole('textbox')).toHaveValue(
    'Черновик остаётся со мной',
  );
  await page.route('**/api/v1/activity/news', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: 'UNAVAILABLE', message: 'Unavailable' } },
    }),
  );
  await dialog
    .getByRole('button', { name: 'Опубликовать', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByRole('textbox')).toHaveValue(
    'Черновик остаётся со мной',
  );
});

test('mobile settings is a section list; opening appearance does not scroll past account information', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/t/alpha/settings');
  await expect(
    page.getByRole('heading', { name: 'Настройки', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Профиль, пароль и способы входа управляются в UpdSpaceID.'),
  ).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Внешний вид' })).toBeVisible();
  await page.getByRole('link', { name: 'Внешний вид' }).click();
  await expect(page).toHaveURL(/tab=appearance/);
  await expect(
    page.getByRole('heading', { name: 'Внешний вид', exact: true }),
  ).toBeInViewport();
  await page.getByRole('link', { name: 'Все настройки' }).click();
  await page.getByRole('link', { name: 'Аккаунт и безопасность' }).click();
  await expect(page).toHaveURL(/tab=account/);
  await expect(
    page.getByText(
      'Ссылка на управление аккаунтом сейчас недоступна. Попробуйте позже.',
    ),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Настройки', exact: true }),
  ).toBeVisible();
});

test('mobile feed shows posts first and moves filters and editing into dismissible dialogs', async ({
  page,
}) => {
  await setup(page, true);
  await page.goto('/t/alpha/feed');
  await expect(page.getByText(post.payload_json.body)).toBeInViewport();
  await expect(
    page.getByText(
      'Новости сообщества, голосования и игровые события в одном месте.',
    ),
  ).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Фильтры ленты' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Фильтры ленты' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Написать публикацию' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Новая публикация' }),
  ).toBeVisible();
  await page.getByLabel('Текст новости').fill('Мой текст');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Написать публикацию' }).click();
  await expect(page.getByLabel('Текст новости')).toHaveValue('Мой текст');
});

test('voting status controls align labels vertically and fit one mobile row', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/t/alpha/voting');
  const controls = page.getByRole('group', { name: 'Статус голосований' });
  await expect(controls).toBeVisible();
  await expect(
    controls.getByRole('button', { name: 'Активные', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const geometry = await controls.getByRole('button').evaluateAll((buttons) =>
    buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(
        button.querySelector('.g-button__text') || button,
      );
      const label = range.getBoundingClientRect();
      return {
        top: rect.top,
        height: rect.height,
        offset: Math.abs(
          label.top + label.height / 2 - (rect.top + rect.height / 2),
        ),
      };
    }),
  );
  expect(new Set(geometry.map((rect) => Math.round(rect.top))).size).toBe(1);
  for (const rect of geometry) {
    expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rect.offset).toBeLessThan(3);
  }
});

for (const width of [360, 390, 768, 1280])
  for (const theme of ['light', 'dark'] as const) {
    test(`content hierarchy ${theme} ${width}`, async ({ page }) => {
      test.setTimeout(60000);
      await setup(page, true);
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await loadedPreferences(page, theme);
      await page.route('**/api/v1/voting/polls**', (route) =>
        route.fulfill({
          json: {
            items: [
              {
                id: 'poll-1',
                tenant_id: memberships[0].tenant_id,
                title: 'Во что играем в выходные?',
                description:
                  'Выбираем игру для следующей встречи. Присоединиться сможет каждый.',
                status: 'active',
                scope_type: 'TENANT',
                scope_id: memberships[0].tenant_id,
                visibility: 'public',
                allow_revoting: true,
                anonymous: false,
                results_visibility: 'after_closed',
                settings: {},
                created_by: uid,
                starts_at: null,
                ends_at: '2026-10-04T18:00:00Z',
                created_at: '2026-09-29T09:00:00Z',
                updated_at: '2026-09-29T09:00:00Z',
              },
            ],
            pagination: {
              total: 1,
              limit: 12,
              offset: 0,
              has_next: false,
              has_prev: false,
            },
          },
        }),
      );
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      for (const route of [
        'profile',
        'feed',
        'voting',
        'settings',
        'settings?tab=appearance',
        'settings?tab=privacy',
      ]) {
        await page.goto(`/t/alpha/${route}`);
        await expect(page.locator('#main-content')).toBeVisible();
        await expect(page.locator('#main-content .app-loader')).toHaveCount(0);
        if (route === 'profile' || route === 'feed')
          await expect(page.getByText(post.payload_json.body)).toBeVisible();
        if (route === 'voting')
          await expect(
            page.getByRole('heading', { name: 'Во что играем в выходные?' }),
          ).toBeVisible();
        if (route === 'settings?tab=appearance')
          await expect(page.getByTestId('theme-option-dark')).toBeVisible();
        expect
          .soft(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            route,
          )
          .toBe(true);
        await page.screenshot({
          path: `/tmp/portal-mobile-review/${route.replace('?tab=', '-')}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
      if (width === 390) {
        await page.goto('/t/alpha/profile');
        await page
          .getByRole('button', { name: 'О профиле', exact: true })
          .click();
        await page.screenshot({
          path: `/tmp/portal-mobile-review/profile-details-${theme}.png`,
        });
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Написать публикацию' }).click();
        await page.screenshot({
          path: `/tmp/portal-mobile-review/profile-composer-${theme}.png`,
        });
      }
      expect(errors).toEqual([]);
    });
  }

test('mobile preference details disclose secondary controls and preserve a queued save when going back', async ({
  page,
}) => {
  await setup(page);
  await loadedPreferences(page, 'dark');
  const writes: unknown[] = [];
  await page.route('**/api/v1/personalization/preferences', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }
    writes.push(route.request().postDataJSON());
    await route.fulfill({
      status: 503,
      json: { error: { code: 'UNAVAILABLE', message: 'Unavailable' } },
    });
  });
  await page.goto('/t/alpha/settings?tab=privacy');
  await expect(
    page.getByRole('switch', { name: 'Показывать онлайн-статус', exact: true }),
  ).not.toBeVisible();
  await page.getByText('Активность и статус', { exact: true }).click();
  const toggle = page.getByRole('switch', {
    name: 'Показывать онлайн-статус',
    exact: true,
  });
  await expect(toggle).toBeVisible();
  const row = toggle.locator(
    'xpath=ancestor::div[contains(@class,"settings-row--toggle")][1]',
  );
  const controlBox = await toggle
    .locator('xpath=ancestor::label[1]')
    .boundingBox();
  const labelBox = await row.locator('.settings-row__info').boundingBox();
  expect(controlBox!.x).toBeGreaterThan(labelBox!.x + labelBox!.width);
  await toggle.click();
  await page.getByRole('link', { name: 'Все настройки' }).click();
  await expect.poll(() => writes.length).toBe(1);
  await page.getByRole('link', { name: 'Приватность', exact: true }).click();
  await expect(
    page.getByText('Ошибка сохранения', { exact: false }),
  ).toBeVisible();
  expect(writes[0]).toMatchObject({ privacy: { show_online_status: false } });
});
