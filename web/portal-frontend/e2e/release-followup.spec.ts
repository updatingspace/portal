import { test, expect, type Page } from '@playwright/test';
import { extendedSession, auditUser } from './fixtures/extended';
import { memberships } from './fixtures/portal';

test.use({ timezoneId: 'America/New_York' });
async function english(page: Page) {
  await extendedSession(page);
  await page.addInitScript(() => {
    localStorage.setItem('portal_locale_v1', 'en');
    localStorage.setItem('portal_timezone_v1', 'UTC');
  });
  await page.route('**/api/v1/session/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: auditUser,
          language: 'en',
          master_flags: { system_admin: true },
        },
        tenant: { id: memberships[0].tenant_id, slug: 'alpha' },
        portal_profile: { display_name: 'Player', language: 'en' },
      },
    }),
  );
}
for (const width of [390, 1280]) {
  test(`English lists and client timezone at ${width}`, async ({
    page,
  }, info) => {
    await english(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    const paths: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/events'))
        paths.push(new URL(request.url()).pathname);
    });
    await page.goto('/t/alpha');
    await expect(page.getByText('Альфа: встреча')).toBeVisible();
    expect(paths).toContain('/api/v1/events/events/');
    await expect(page.locator('html')).toHaveAttribute(
      'data-timezone',
      'America/New_York',
    );
    await page.goto('/t/alpha/events');
    await expect(
      page.getByRole('heading', { name: 'Events', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Альфа: встреча')).toBeVisible();
    await expect(page.getByText('UTC', { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('combobox', { name: 'My response', exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath(`events-${width}.png`),
      fullPage: true,
    });
    let release: () => void = () => {};
    const delay = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/v1/voting/polls?**', async (route) => {
      await delay;
      await route.fulfill({
        json: { items: [], pagination: { total: 0, limit: 20, offset: 0 } },
      });
    });
    await page.goto('/t/alpha/voting');
    await expect(
      page.getByRole('heading', { name: 'Voting', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('status', { name: 'Loading polls' }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`voting-loading-${width}.png`),
      fullPage: true,
    });
    release();
    await expect(
      page.getByRole('status', { name: 'Loading polls' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Create poll', exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Templates', exact: true }),
    ).toHaveCount(0);
    await expect(page).toHaveTitle(/Voting/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`voting-empty-${width}.png`),
      fullPage: true,
    });
  });
  test(`feature creation retains errors and updates list at ${width}`, async ({
    page,
  }, info) => {
    await english(page);
    await page.setViewportSize({ width, height: 900 });
    let fail = true;
    await page.route('**/api/v1/feature-flags/flags', async (route) => {
      if (route.request().method() === 'POST') {
        if (fail) {
          await route.fulfill({
            status: 503,
            json: { error: { code: 'UNAVAILABLE', message: 'Unavailable' } },
          });
        } else {
          await route.fulfill({
            json: {
              ...route.request().postDataJSON(),
              created_at: '2026-10-01T00:00:00Z',
              updated_at: '2026-10-01T00:00:00Z',
            },
          });
        }
      } else await route.fulfill({ json: [] });
    });
    await page.goto('/t/alpha/feature-flags');
    await expect(
      page.getByRole('heading', { name: 'No features yet' }),
    ).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await page.getByRole('button', { name: 'New feature' }).click();
    const dialog = page.getByRole('dialog', { name: 'New feature' });
    await dialog.getByLabel('Key', { exact: true }).fill('community_calendar');
    await dialog
      .getByLabel('Description', { exact: true })
      .fill('Community calendar');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog.getByLabel('Key', { exact: true })).toHaveValue(
      'community_calendar',
    );
    fail = false;
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Community calendar', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`flags-${width}.png`),
      fullPage: true,
    });
  });
}

test('achievement image upload replaces URL entry and keeps publication explicit', async ({
  page,
}, info) => {
  await english(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/gamification/media', async (route) => {
    expect(route.request().headers()['content-type']).toContain(
      'multipart/form-data',
    );
    await route.fulfill({ json: { url: '/test-award.png' } });
  });
  await page.route('**/test-award.png', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMZsAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.goto('/t/alpha/gamification/achievements/new');
  await page.getByLabel('Name', { exact: true }).fill('Team helper');
  await page.getByLabel('Upload image', { exact: true }).setInputFiles({
    name: 'award.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMZsAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(
    page.locator('.achievement-workspace__preview img'),
  ).toHaveAttribute('src', '/test-award.png');
  await expect(
    page.getByRole('button', { name: 'Publish', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Status' })).toHaveCount(0);
  await expect(
    page.getByLabel('Image link', { exact: true }),
  ).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('achievement-editor-mobile.png'),
    fullPage: true,
  });
});

test('members open a focused dialog and assign only a named scope after confirmation', async ({
  page,
}, info) => {
  await english(page);
  await page.setViewportSize({ width: 390, height: 844 });
  let saved: unknown;
  await page.route('**/api/v1/portal/communities', (route) =>
    route.fulfill({ json: [{ id: 'group-1', name: 'Minecraft players' }] }),
  );
  await page.route('**/api/v1/access/admin/role-bindings', async (route) => {
    if (route.request().method() === 'POST') {
      saved = route.request().postDataJSON();
      await route.fulfill({ json: { id: 5, ...(saved as object) } });
    } else await route.fulfill({ json: [] });
  });
  await page.goto('/t/alpha/tenant-admin?tab=members');
  await expect(
    page.getByRole('heading', { name: 'Community management', exact: true }),
  ).toBeVisible();
  await page.locator('.tenant-admin__mobile-members button').first().click();
  const dialog = page.getByRole('dialog').first();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox')).toHaveCount(0);
  await dialog.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option').first().click();
  await dialog
    .getByRole('combobox', { name: 'Role applies to', exact: true })
    .click();
  await page.getByRole('option', { name: 'Group', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Group', exact: true }).click();
  await page.getByRole('option', { name: 'Minecraft players' }).click();
  await dialog
    .getByRole('button', { name: 'Assign role', exact: true })
    .click();
  expect(saved).toBeUndefined();
  await page
    .getByRole('dialog', { name: 'Confirm action' })
    .getByRole('button', { name: 'Confirm', exact: true })
    .click();
  await expect
    .poll(() => saved)
    .toMatchObject({
      scope_type: 'COMMUNITY',
      scope_id: 'group-1',
      tenant_id: memberships[0].tenant_id,
    });
  await page.screenshot({
    path: info.outputPath('member-access-mobile.png'),
    fullPage: true,
  });
});

test('moderation belongs to a post and preserves the reason after rejection', async ({
  page,
}, info) => {
  await english(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const post = {
    id: 1,
    tenant_id: memberships[0].tenant_id,
    actor_user_id: auditUser,
    type: 'news.posted',
    occurred_at: new Date().toISOString(),
    title: 'Friday meetup',
    payload_json: {
      news_id: 'news-1',
      body: 'Bring your favourite game.',
      tags: [],
      media: [],
      status: 'published',
      comments_count: 0,
      reactions_count: 0,
      views_count: 1,
      reaction_counts: [],
      my_reactions: [],
    },
    visibility: 'public',
    scope_type: 'TENANT',
    scope_id: memberships[0].tenant_id,
    source_ref: 'news-1',
  };
  let removed = false;
  let fail = true;
  await page.route('**/api/v1/activity/v2/feed**', (route) =>
    route.fulfill({
      json: {
        items: removed ? [] : [post],
        has_more: false,
        next_cursor: null,
      },
    }),
  );
  await page.route('**/api/v1/activity/news/news-1/audit', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 1,
            action: 'news.created',
            created_at: '2026-10-01T01:00:00Z',
            reason: null,
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/activity/news/news-1', async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    expect(route.request().postDataJSON()).toEqual({
      reason: 'Duplicate announcement',
    });
    if (fail)
      await route.fulfill({
        status: 503,
        json: { error: { code: 'UNAVAILABLE', message: 'Unavailable' } },
      });
    else {
      removed = true;
      await route.fulfill({ json: { ok: true } });
    }
  });
  await page.goto('/t/alpha/feed');
  await expect(page.getByText('Moderation panel', { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Post actions', exact: true }).click();
  await page.getByText('Moderation and history', { exact: true }).click();
  await expect(
    page.getByRole('dialog').getByText('Post created', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Remove post…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this post?' });
  await dialog.getByLabel('Reason for removal').fill('Duplicate announcement');
  await dialog
    .getByRole('button', { name: 'Remove post', exact: true })
    .click();
  await expect(
    dialog.getByText('Unable to remove the post. Your reason is still here.'),
  ).toBeVisible();
  await expect(dialog.getByLabel('Reason for removal')).toHaveValue(
    'Duplicate announcement',
  );
  await page.screenshot({
    path: info.outputPath('post-moderation-mobile.png'),
    fullPage: true,
  });
  fail = false;
  await dialog
    .getByRole('button', { name: 'Remove post', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText('Bring your favourite game.', { exact: true }),
  ).toHaveCount(0);
});
