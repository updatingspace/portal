import { expect, test, type Locator, type Page } from '@playwright/test';
import { extendedSession, auditUser } from './fixtures/extended';
import { memberships } from './fixtures/portal';

async function setup(page: Page, language: 'en' | 'ru') {
  await extendedSession(page);
  await page.addInitScript((locale) => {
    localStorage.setItem('portal_locale_v1', locale);
  }, language);
  await page.route('**/api/v1/session/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: auditUser,
          language,
          master_flags: { system_admin: true },
        },
        tenant: { id: memberships[0].tenant_id, slug: 'alpha' },
        portal_profile: { display_name: 'Player', language },
      },
    }),
  );
}

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  return (await locator.boundingBox())!;
}

async function centeredButton(locator: Locator) {
  const control = await box(locator);
  const label = await box(locator.locator('.g-button__text'));
  expect(control.height).toBeGreaterThanOrEqual(44);
  expect(
    Math.abs(label.y + label.height / 2 - control.y - control.height / 2),
  ).toBeLessThanOrEqual(1);
  expect(label.x - control.x).toBeGreaterThanOrEqual(12);
  expect(
    control.x + control.width - label.x - label.width,
  ).toBeGreaterThanOrEqual(12);
}

for (const width of [360, 390, 768, 1280]) {
  for (const language of ['en', 'ru'] as const) {
    test(`events spacing ${width} ${language}`, async ({ page }, info) => {
      await setup(page, language);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({
        colorScheme: language === 'en' ? 'dark' : 'light',
        reducedMotion: 'reduce',
      });
      await page.goto('/t/alpha/events');
      await expect(page.getByText('Альфа: встреча')).toBeVisible();
      const title = await box(
        page.getByRole('heading', {
          name: language === 'en' ? 'Events' : 'События',
          exact: true,
        }),
      );
      const create = page.getByRole('button', {
        name: language === 'en' ? 'Create event' : 'Создать событие',
        exact: true,
      });
      await centeredButton(create);
      const action = await box(create);
      const tabs = await box(
        page.getByRole('group', {
          name: language === 'en' ? 'Period' : 'Период',
        }),
      );
      const search = await box(
        page.locator('.portal-event-list-tools > .g-text-input'),
      );
      const filters = page.getByRole('button', {
        name: language === 'en' ? 'Filters' : 'Фильтры',
        exact: true,
      });
      await centeredButton(filters);
      expect(search.y - tabs.y - tabs.height).toBeLessThanOrEqual(16);
      if (width < 720) {
        expect(action.y - title.y - title.height).toBeLessThanOrEqual(16);
        expect(tabs.y - action.y - action.height).toBeLessThanOrEqual(16);
        const calendar = page.getByRole('button', {
          name: language === 'en' ? 'Calendar' : 'Календарь',
          exact: true,
        });
        await centeredButton(calendar);
        const filterBox = await box(filters);
        const calendarBox = await box(calendar);
        expect(calendarBox.y).toBe(filterBox.y);
        expect(filterBox.y - search.y - search.height).toBeLessThanOrEqual(8);
        const date = await box(page.locator('.portal-event-day-heading'));
        const cardDate = await box(page.getByTestId('event-day'));
        expect(cardDate.y - date.y - date.height).toBeLessThanOrEqual(36);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath('events.png'),
        fullPage: true,
      });
      await filters.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await centeredButton(
        dialog.getByRole('button', {
          name: language === 'en' ? 'Show events' : 'Показать события',
        }),
      );
      await page.screenshot({
        path: info.outputPath('filters.png'),
        fullPage: true,
      });
      await page.keyboard.press('Escape');
      await expect(filters).toBeFocused();
    });
  }
}
