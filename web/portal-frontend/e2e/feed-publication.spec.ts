import { expect, test } from '@playwright/test';
import { session, memberships } from './fixtures/portal';

for (const language of ['en', 'ru'] as const) {
  test(`mobile publication preserves the draft after a server error in ${language}`, async ({
    page,
  }, info) => {
    await session(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.addInitScript(
      (locale) => localStorage.setItem('portal_locale_v1', locale),
      language,
    );
    const userId = '11111111-1111-4111-8111-111111111111';
    await page.route('**/api/v1/session/me', (route) =>
      route.fulfill({
        json: {
          user: { id: userId, language, master_flags: { system_admin: true } },
          tenant: { id: memberships[0].tenant_id, slug: 'alpha' },
          portal_profile: { display_name: 'Player', language },
        },
      }),
    );
    // A successful write must remain available when the feed is refreshed.
    const publishedItems: unknown[] = [];
    await page.route('**/api/v1/activity/v2/feed?**', (route) =>
      route.fulfill({
        json: { items: publishedItems, has_more: false, next_cursor: null },
      }),
    );
    let requests = 0;
    let fail = true;
    await page.route('**/api/v1/activity/news', async (route) => {
      requests += 1;
      if (fail)
        return route.fulfill({
          status: 500,
          json: {
            error: {
              code: 'UPSTREAM_ERROR',
              message: 'feed upstream returned error',
            },
          },
        });
      const { body } = route.request().postDataJSON();
      const created = {
        id: 1,
        tenant_id: memberships[0].tenant_id,
        actor_user_id: userId,
        type: 'news.posted',
        occurred_at: new Date().toISOString(),
        title: body,
        visibility: 'public',
        scope_type: 'TENANT',
        scope_id: memberships[0].tenant_id,
        source_ref: 'news:local-post',
        payload_json: {
          news_id: 'local-post',
          body,
          status: 'published',
          media: [],
          tags: [],
          reaction_counts: [],
          my_reactions: [],
        },
      };
      publishedItems.push(created);
      await route.fulfill({ json: created });
    });
    await page.goto('/t/alpha/feed');
    await page
      .getByRole('button', {
        name: language === 'en' ? 'Write a post' : 'Написать публикацию',
      })
      .click();
    const dialog = page.getByRole('dialog');
    const input = dialog.getByRole('textbox');
    await input.fill('Local browser regression');
    const submit = dialog.locator('[data-qa="composer-submit"]');
    await submit.click();
    await expect(dialog.getByRole('alert')).toHaveCount(1);
    await expect(dialog.getByRole('alert')).toContainText(
      language === 'en'
        ? 'We could not confirm the result.'
        : 'Не удалось подтвердить результат.',
    );
    await expect(input).toHaveValue('Local browser regression');
    await expect(page.locator('.g-toaster')).not.toContainText('upstream');
    expect(requests).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(submit).toBeInViewport();
    await page.screenshot({
      path: info.outputPath(`publication-error-${language}.png`),
      fullPage: true,
    });
    // Retrying is an explicit user action, after inspecting the feed.
    fail = false;
    await submit.click();
    await expect(dialog).toHaveCount(0);
    expect(requests).toBe(2);
    await expect(
      page.getByText('Local browser regression', { exact: true }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText('Local browser regression', { exact: true }).first(),
    ).toBeVisible();
    expect(requests).toBe(2);
  });
}
