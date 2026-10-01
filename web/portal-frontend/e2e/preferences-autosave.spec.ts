import { expect, test, type Page } from '@playwright/test';
import { memberships, session } from './fixtures/portal';
import type {
  PreferencesUpdatePayload,
  UserPreferences,
} from '../src/features/personalization/types';

async function settings(page: Page, language: 'en' | 'ru' = 'en') {
  await session(page);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  let data: UserPreferences = {
    id: 'preferences',
    user_id: '11111111-1111-4111-8111-111111111111',
    tenant_id: memberships[0].tenant_id,
    appearance: {
      theme: 'dark',
      theme_source: 'portal',
      accent_color: '#7557F5',
      font_size: 'medium',
      high_contrast: false,
      reduce_motion: true,
    },
    localization: { language, timezone: 'Europe/Moscow' },
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
  const defaults = structuredClone(data);
  const writes: PreferencesUpdatePayload[] = [];
  let fail = false;
  let release: (() => void) | undefined;
  let hold: Promise<void> | undefined;
  await page.route('**/api/v1/personalization/preferences**', async (route) => {
    const request = route.request();
    if (request.method() === 'PUT') {
      const change = request.postDataJSON() as PreferencesUpdatePayload;
      writes.push(change);
      if (hold) await hold;
      if (fail) {
        fail = false;
        await route.fulfill({
          status: 503,
          json: { error: { code: 'UNAVAILABLE', message: 'Unavailable' } },
        });
        return;
      }
      data = {
        ...data,
        appearance: { ...data.appearance, ...change.appearance },
        localization: { ...data.localization, ...change.localization },
        notifications: { ...data.notifications, ...change.notifications },
        privacy: { ...data.privacy, ...change.privacy },
      };
    }
    if (request.url().endsWith('/reset')) data = structuredClone(defaults);
    await route.fulfill({ json: data });
  });
  return {
    writes,
    fail: () => {
      fail = true;
    },
    hold: () => {
      hold = new Promise((resolve) => {
        release = resolve;
      });
    },
    release: () => {
      hold = undefined;
      release?.();
    },
  };
}

for (const [language, width] of [
  ['en', 390],
  ['ru', 360],
] as const) {
  test(`appearance switches immediately without a save workflow on mobile ${language}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const server = await settings(page, language);
    await page.goto('/t/alpha/settings?tab=appearance');
    await expect(page.getByTestId('theme-option-dark')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    server.hold();
    await page.getByTestId('theme-option-light').click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme-mode',
      'light',
      { timeout: 500 },
    );
    await expect(page.locator('body')).toHaveClass(/g-root_theme_light/);
    await expect(
      page.getByText(
        /Save Now|Unsaved changes|Сохранить сейчас|Несохранённые изменения/,
      ),
    ).toHaveCount(0);
    await page.getByTestId('color-preset-2563eb').click();
    await expect
      .poll(() =>
        page
          .locator('html')
          .evaluate((el) => el.style.getPropertyValue('--user-accent-color')),
      )
      .toBe('#2563EB');
    expect(server.writes).toHaveLength(1);
    await page.screenshot({
      path: `/tmp/portal-instant-preferences/appearance-${language}-${width}-light.png`,
    });
    server.release();
    await expect.poll(() => server.writes.length).toBe(2);
    await page.getByTestId('theme-option-auto').click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme-mode',
      'auto',
    );
    await expect(page.locator('body')).toHaveClass(/g-root_theme_dark/);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('body')).toHaveClass(/g-root_theme_light/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test('the last selection persists after navigating away during a slow save', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const server = await settings(page);
  await page.goto('/t/alpha/settings?tab=appearance');
  await expect(page.getByTestId('theme-option-dark')).toBeVisible();
  server.hold();
  await page.getByTestId('theme-option-light').click();
  await expect.poll(() => server.writes.length).toBe(1);
  await page.getByTestId('theme-option-auto').click();
  await page.getByTestId('color-preset-d97706').click();
  await page.getByRole('link', { name: 'Activity Feed', exact: true }).click();
  await expect(page).toHaveURL(/\/feed$/);
  server.release();
  await expect.poll(() => server.writes.length).toBe(2);
  expect(server.writes[1]).toEqual({
    appearance: {
      theme: 'auto',
      theme_source: 'portal',
      accent_color: '#D97706',
    },
  });
  await page.goBack();
  await expect(page.getByTestId('theme-option-auto')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(
    page.getByRole('textbox', { name: 'Hex color value' }),
  ).toHaveValue('#D97706');
  await page.reload();
  await expect(page.getByTestId('theme-option-auto')).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('failure preserves the selected theme, retry is explicit, and reset updates the color input', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const server = await settings(page);
  await page.goto('/t/alpha/settings?tab=appearance');
  await expect(page.getByTestId('theme-option-dark')).toBeVisible();
  server.fail();
  await page.getByTestId('theme-option-light').click();
  await expect(
    page.getByText('Could not sync settings.', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/g-root_theme_light/);
  expect(server.writes).toHaveLength(1);
  await page
    .getByRole('alert')
    .getByRole('button', { name: 'Try again', exact: true })
    .click();
  await expect(
    page.getByText('Could not sync settings.', { exact: false }),
  ).toHaveCount(0);
  await expect.poll(() => server.writes.length).toBe(2);
  await page.getByTestId('color-preset-d97706').click();
  await page
    .locator('summary')
    .filter({ hasText: 'Reset to Defaults' })
    .click();
  await page
    .getByRole('button', { name: 'Reset to Defaults', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Reset to Defaults', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('theme-option-dark')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(
    page.getByRole('textbox', { name: 'Hex color value' }),
  ).toHaveValue('#7557F5');
  expect(
    await page
      .locator('h1, h3')
      .evaluateAll((elements) =>
        elements.map((el) => getComputedStyle(el).color),
      ),
  ).toEqual(['rgb(244, 247, 255)', 'rgb(244, 247, 255)', 'rgb(244, 247, 255)']);
  await page.screenshot({
    path: '/tmp/portal-instant-preferences/appearance-en-390-dark.png',
  });
});
