import { expect, test, type Page } from '@playwright/test';
import { memberships, session } from './fixtures/portal';

async function setup(page: Page, language: 'ru' | 'en' = 'en', owner = false) {
  await session(page);
  await page.addInitScript(
    (lang) => localStorage.setItem('portal_locale_v1', lang),
    language,
  );
  let left = false;
  let fail = false;
  let loseResponse = false;
  const writes: string[] = [];
  const active = {
    ...memberships[0],
    display_name: 'Alpha',
    base_role: owner ? 'owner' : 'member',
  };
  await page.route('**/api/v1/session/me', (route) =>
    route.fulfill({
      json: {
        user: { id: '11111111-1111-4111-8111-111111111111' },
        tenant: left ? null : { id: active.tenant_id, slug: 'alpha' },
        active_tenant: left ? null : active,
        portal_profile: { display_name: 'Player', language },
        capabilities: ['portal.profile.read_self'],
      },
    }),
  );
  await page.route('**/api/v1/session/tenants', (route) =>
    route.fulfill({ json: left ? [memberships[1]] : [active, memberships[1]] }),
  );
  await page.route('**/api/v1/entry/me', (route) =>
    route.fulfill({
      json: {
        user: { id: '11111111-1111-4111-8111-111111111111' },
        memberships: left ? [memberships[1]] : [active, memberships[1]],
        pending_tenant_applications: [],
        tenant_applications: [],
      },
    }),
  );
  await page.route('**/api/v1/entry/memberships/*/leave', async (route) => {
    writes.push(route.request().url());
    if (fail)
      return route.fulfill({
        status: 503,
        json: { error: { code: 'UNAVAILABLE', message: 'Unavailable' } },
      });
    left = true;
    if (loseResponse) return route.abort();
    return route.fulfill({
      json: { tenant_id: active.tenant_id, status: 'left' },
    });
  });
  return {
    writes,
    fail: () => {
      fail = true;
    },
    loseResponse: () => {
      loseResponse = true;
    },
  };
}
for (const language of ['en', 'ru'] as const) {
  for (const theme of ['dark', 'light'] as const) {
    test(`compact membership, confirmation and exit ${language} ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: language === 'en' ? 390 : 360,
        height: 844,
      });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      const api = await setup(page, language);
      await page.goto('/t/alpha/settings?tab=community');
      await expect(
        page.getByRole('heading', {
          name: language === 'en' ? 'Settings' : 'Настройки',
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', {
          name: language === 'en' ? 'Community' : 'Сообщество',
          exact: true,
        }),
      ).toHaveCount(0);
      const leave = page.getByRole('button', {
        name: language === 'en' ? 'Leave…' : 'Покинуть…',
        exact: true,
      });
      await leave.click();
      expect(api.writes).toHaveLength(0);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(leave).toBeFocused();
      await leave.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: test.info().outputPath(`membership-${language}-${theme}.png`),
      });
      await page
        .getByRole('button', {
          name: language === 'en' ? 'Leave community' : 'Покинуть сообщество',
          exact: true,
        })
        .click();
      await expect(page).toHaveURL(/\/choose-tenant$/);
      expect(api.writes).toHaveLength(1);
      await expect(page.getByText('Alpha', { exact: true })).toHaveCount(0);
    });
  }
}
test('leave failure keeps context and a lost response is reconciled', async ({
  page,
}) => {
  const api = await setup(page);
  api.fail();
  await page.goto('/t/alpha/settings');
  await page.getByRole('button', { name: 'Leave…' }).click();
  await page
    .getByRole('button', { name: 'Leave community', exact: true })
    .click();
  await expect(
    page.getByText('Unable to confirm leaving. Try again.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/t\/alpha\/settings$/);
  expect(api.writes).toHaveLength(1);
});
test('lost leave response does not cause a duplicate submission', async ({
  page,
}) => {
  const api = await setup(page);
  api.loseResponse();
  await page.goto('/t/alpha/settings');
  await page.getByRole('button', { name: 'Leave…' }).click();
  await page
    .getByRole('button', { name: 'Leave community', exact: true })
    .click();
  await expect(page).toHaveURL(/\/choose-tenant$/);
  expect(api.writes).toHaveLength(1);
});
test('owner gets a clear explanation without a destructive action', async ({
  page,
}) => {
  const api = await setup(page, 'en', true);
  await page.goto('/t/alpha/settings');
  await page.getByRole('button', { name: 'Leave…' }).click();
  await expect(page.getByText(/You own this community/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Leave community', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Got it' }).click();
  expect(api.writes).toHaveLength(0);
});
