import { expect, test, type Page } from '@playwright/test';

test.use({
  baseURL: `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || '4173'}`,
  viewport: { width: 1440, height: 1000 },
});

type Theme = 'light' | 'dark';

async function openDashboard(
  page: Page,
  theme: Theme | 'auto',
  highContrast?: boolean,
) {
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    display_name: 'Theme Test',
  };
  const tenant = {
    tenant_id: '22222222-2222-4222-8222-222222222222',
    tenant_slug: 'theme-test',
    display_name: 'Theme Test',
    status: 'active',
    base_role: 'owner',
  };
  const preferences = {
    id: 'preferences-test',
    user_id: user.id,
    tenant_id: tenant.tenant_id,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    appearance: {
      theme,
      theme_source: 'portal',
      accent_color: '#2f6edb',
      font_size: 'medium',
      high_contrast: highContrast ?? false,
      reduce_motion: true,
    },
    localization: { language: 'en', timezone: 'UTC' },
  };
  await page.addInitScript(
    (mode) => localStorage.setItem('updspace-theme', mode),
    theme,
  );
  await page.context().addCookies([
    {
      name: 'updspace_csrf',
      value: 'theme-test-csrf',
      url: 'http://127.0.0.1:4173',
    },
  ]);
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = [];
    if (path === '/api/v1/session/me') {
      response = {
        user,
        tenant: { id: tenant.tenant_id, slug: tenant.tenant_slug },
        id_profile: { user },
        active_tenant: tenant,
        available_tenants: [tenant],
      };
    } else if (path === '/api/v1/session/switch-tenant') {
      response = { active_tenant: tenant };
    } else if (path.startsWith('/api/v1/personalization/preferences')) {
      if (highContrast === undefined) {
        await route.fulfill({
          status: 503,
          json: { code: 'UNAVAILABLE', message: 'Preferences unavailable' },
        });
        return;
      }
      response = preferences;
    }
    await route.fulfill({ json: response });
  });
  await page.goto('/t/theme-test/');
  await expect(page.locator('.dashboard-page')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute(
    'data-high-contrast',
    String(highContrast ?? false),
  );
}

async function expectReadableTheme(page: Page, theme: Theme) {
  await expect(page.locator('body')).toHaveClass(
    new RegExp(`g-root_theme_${theme}`),
  );
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(async () => {
    const colors = await page.evaluate(() => {
      const header = document.querySelector('.app-shell__header')!;
      const heading = document.querySelector('.dashboard-page__header')!;
      const text = document.querySelector('.app-shell__user-name')!;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d')!;
      const pixel = () =>
        Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
      const background = getComputedStyle(header).backgroundColor;
      context.fillStyle = background;
      context.fillRect(0, 0, 1, 1);
      const surface = pixel();
      context.fillStyle = getComputedStyle(text).color;
      context.fillRect(0, 0, 1, 1);
      const foreground = pixel();
      context.fillStyle = background;
      context.fillRect(0, 0, 1, 1);
      context.fillStyle = getComputedStyle(heading).color;
      context.fillRect(0, 0, 1, 1);
      return { surface, foreground, heading: pixel() };
    });
    const luminance = (rgb: number[]) =>
      rgb
        .map((value) => value / 255)
        .map((value) =>
          value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
        )
        .reduce(
          (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    const background = luminance(colors.surface);
    if (theme === 'dark') expect(background).toBeLessThan(0.1);
    else expect(background).toBeGreaterThan(0.8);
    for (const color of [colors.foreground, colors.heading]) {
      const foreground = luminance(color);
      expect(
        (Math.max(background, foreground) + 0.05) /
          (Math.min(background, foreground) + 0.05),
      ).toBeGreaterThanOrEqual(4.5);
    }
  }).toPass({ timeout: 3000 });
}

for (const theme of ['light', 'dark'] as const) {
  for (const highContrast of [undefined, false, true]) {
    test(`${theme} dashboard stays readable with ${highContrast === undefined ? 'unavailable preferences' : `high contrast ${highContrast}`}`, async ({
      page,
    }) => {
      await openDashboard(page, theme, highContrast);
      await expectReadableTheme(page, theme);
    });
  }
}

test('auto theme follows OS changes with high contrast enabled', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openDashboard(page, 'auto', true);
  await expectReadableTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expectReadableTheme(page, 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectReadableTheme(page, 'dark');
});
