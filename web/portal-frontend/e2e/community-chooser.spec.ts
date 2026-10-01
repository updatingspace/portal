import { expect, test } from '@playwright/test';

for (const locale of ['ru', 'en'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [390, 1280]) {
      test(`community chooser ${locale} ${theme} ${width}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript(
          ({ locale, theme }) => {
            localStorage.setItem('portal_locale_v1', locale);
            localStorage.setItem('updspace-theme', theme);
          },
          { locale, theme },
        );
        const t = (ru: string, en: string) => (locale === 'ru' ? ru : en);
        const user = {
          id: '11111111-1111-4111-8111-111111111111',
          display_name: 'Alex Example',
          language: locale,
          avatar_url: '/test-avatar.svg',
          master_flags: { system_admin: true },
        };
        const memberships = [
          {
            tenant_id: '22222222-2222-4222-8222-222222222222',
            tenant_slug: 'alpha',
            display_name: 'Alpha Space',
            status: 'active',
            base_role: 'owner',
          },
          {
            tenant_id: '33333333-3333-4333-8333-333333333333',
            tenant_slug: 'beta',
            display_name: 'Beta',
            status: 'active',
            base_role: 'member',
          },
        ];
        let releaseEntry!: () => void;
        const entryReady = new Promise<void>((resolve) => {
          releaseEntry = resolve;
        });
        let reviewRequests = 0;
        await page.route('**/test-avatar.svg', (route) =>
          route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="20" fill="#7557f5"/></svg>',
          }),
        );
        await page.route('**/api/v1/**', async (route) => {
          const path = new URL(route.request().url()).pathname;
          let json: unknown = [];
          if (path === '/api/v1/session/me')
            json = {
              user,
              tenant: null,
              id_profile: { user },
              portal_profile: { language: locale },
              available_tenants: memberships,
            };
          else if (path === '/api/v1/entry/me') {
            await entryReady;
            json = {
              user,
              memberships,
              last_tenant: null,
              tenant_applications: [
                { id: 'application', slug: 'friends', status: 'pending' },
              ],
              pending_tenant_applications: [],
            };
          } else if (path === '/api/v1/entry/admin/tenant-applications')
            reviewRequests++;
          else if (path.startsWith('/api/v1/personalization/preferences')) {
            await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } });
            return;
          }
          await route.fulfill({ json });
        });
        await page.goto('/choose-tenant');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          t('В какой спейс сегодня?', 'Where to today?'),
        );
        await expect(
          page.getByRole('status', {
            name: t('Загружаем сообщества', 'Loading communities'),
          }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Auto', exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByRole('button', {
            name: t('Обновить статус', 'Refresh status'),
          }),
        ).toHaveCount(0);
        await page.screenshot({
          path: testInfo.outputPath('loading.png'),
          animations: 'disabled',
        });
        const skeletonBounds = await page
          .locator('.space-chooser__skeleton-row')
          .first()
          .boundingBox();
        releaseEntry();
        await expect(
          page.getByRole('button', {
            name: t(
              'Открыть сообщество Alpha Space',
              'Open community Alpha Space',
            ),
          }),
        ).toBeVisible();
        await expect(page.getByText('/alpha', { exact: true })).toHaveCount(0);
        await expect(page.getByText('/beta', { exact: true })).toHaveCount(0);
        const rowBounds = await page
          .locator('.space-chooser__community')
          .first()
          .boundingBox();
        expect(
          Math.abs(skeletonBounds!.height - rowBounds!.height),
        ).toBeLessThanOrEqual(2);
        expect(reviewRequests).toBe(0);
        await expect(page.getByText('friends', { exact: true })).toHaveCount(
          1,
        );
        await expect(
          page.getByText('Alex Example', { exact: true }),
        ).toHaveCount(1);
        const account = page.getByRole('button', { name: /Alex Example/ });
        const bounds = await account.boundingBox();
        expect(bounds?.y).toBeLessThan(45);
        expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeGreaterThan(
          width / 2,
        );
        await expect(account.locator('img')).toHaveJSProperty('complete', true);
        await expect
          .poll(() =>
            account
              .locator('img')
              .evaluate((image) => (image as HTMLImageElement).naturalWidth),
          )
          .toBeGreaterThan(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath('communities.png'),
          animations: 'disabled',
        });
        await page
          .getByRole('button', {
            name: t('Поиск сообществ', 'Find communities'),
          })
          .click();
        const search = page.getByRole('textbox', {
          name: t('Найти сообщество', 'Find a community'),
        });
        await expect(search).toBeFocused();
        await search.fill('Beta');
        await expect(
          page.getByRole('button', {
            name: t(
              'Открыть сообщество Alpha Space',
              'Open community Alpha Space',
            ),
          }),
        ).toHaveCount(0);
        await expect(
          page.getByRole('button', {
            name: t('Открыть сообщество Beta', 'Open community Beta'),
          }),
        ).toBeVisible();
        await search.press('Escape');
        await expect(
          page.getByRole('button', {
            name: t('Поиск сообществ', 'Find communities'),
          }),
        ).toBeFocused();
        await page
          .getByRole('button', {
            name: t('Создать сообщество', 'Create a community'),
            exact: true,
          })
          .click();
        await page
          .getByRole('button', {
            name: t('Продолжить', 'Continue'),
          })
          .click();
        await expect(
          page.getByText(t('Введите название', 'Enter a name'), {
            exact: true,
          }),
        ).toBeVisible();
        await page
          .getByLabel(t('Название', 'Name'), { exact: true })
          .fill('Our new space');
        await page.screenshot({
          path: testInfo.outputPath('application.png'),
          animations: 'disabled',
        });
        await page
          .locator('.portal-content-dialog__header')
          .getByRole('button', { name: t('Закрыть', 'Close'), exact: true })
          .click();
        await page
          .getByRole('button', {
            name: t('Создать сообщество', 'Create a community'),
            exact: true,
          })
          .click();
        await expect(
          page.getByLabel(t('Название', 'Name'), { exact: true }),
        ).toHaveValue('Our new space');
        await page
          .getByRole('button', { name: t('Продолжить', 'Continue') })
          .click();
        const address = page.getByLabel(
          t('Адрес сообщества', 'Community address'),
          { exact: true },
        );
        await expect(address).toBeFocused();
        await address.fill('our-space');
        await page.screenshot({
          path: testInfo.outputPath('application-address.png'),
        });
        await address.press('Enter');
        await expect(
          page.getByRole('heading', {
            name: t('Всё готово?', 'Ready to send?'),
          }),
        ).toBeFocused();
        await expect(
          page.getByText('/t/our-space/', { exact: true }),
        ).toBeVisible();
        const submit = page.getByRole('button', {
          name: t('Отправить заявку', 'Submit application'),
        });
        await expect(submit).toBeInViewport();
        await page.screenshot({
          path: testInfo.outputPath('application-review.png'),
        });
        await page.getByRole('button', { name: t('Назад', 'Back') }).click();
        await expect(address).toHaveValue('our-space');
        await page.getByRole('button', { name: t('Назад', 'Back') }).click();
        await expect(
          page.getByLabel(t('Название', 'Name'), { exact: true }),
        ).toHaveValue('Our new space');
        await page
          .locator('.portal-content-dialog__header')
          .getByRole('button', { name: t('Закрыть', 'Close'), exact: true })
          .click();
        await account.click();
        await page
          .getByText(t('Рассмотреть заявки', 'Review applications'), {
            exact: true,
          })
          .click();
        await expect(
          page.getByText(
            t(
              'Нет заявок на рассмотрении.',
              'No applications awaiting review.',
            ),
          ),
        ).toBeVisible();
        expect(reviewRequests).toBe(1);
      });
    }
  }
}

test('entry failure stays distinct from no communities at 360px', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('portal_locale_v1', 'en');
    localStorage.setItem('updspace-theme', 'dark');
  });
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    display_name: 'Alex Example',
    language: 'en',
  };
  let failed = true;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/session/me') {
      await route.fulfill({
        json: { user, tenant: null, available_tenants: [] },
      });
      return;
    }
    if (path === '/api/v1/entry/me') {
      await route.fulfill(
        failed
          ? { status: 503, json: { error: { code: 'UNAVAILABLE' } } }
          : {
              json: {
                user,
                memberships: [],
                pending_tenant_applications: [],
                last_tenant: null,
              },
            },
      );
      return;
    }
    await route.fulfill({ json: [] });
  });
  await page.goto('/choose-tenant');
  await expect(page.getByRole('alert')).toContainText(
    'Could not load communities',
  );
  await expect(
    page.getByText('You have no communities yet. Choose how to start.'),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('load-error.png'),
    animations: 'disabled',
  });
  failed = false;
  await page
    .getByRole('alert')
    .getByRole('button', { name: 'Try again' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Join by invitation' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Create a community' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Refresh status' }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('no-communities.png'),
    animations: 'disabled',
  });
});
