import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test(`member avatars use the signed-in profile in ${theme} theme`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const userId = '11111111-1111-4111-8111-111111111111';
    const otherId = '33333333-3333-4333-8333-333333333333';
    const tenantId = '22222222-2222-4222-8222-222222222222';
    const avatar = '/test-member-avatar.svg';
    const user = {
      id: userId,
      display_name: 'Мария Иванова',
      avatar_url: avatar,
      language: 'ru',
      master_flags: { system_admin: true },
    };
    const tenant = {
      tenant_id: tenantId,
      tenant_slug: 'test-team',
      display_name: 'Команда',
      status: 'active',
      base_role: 'owner',
    };
    await page.addInitScript((mode) => {
      localStorage.setItem('updspace-theme', mode);
      localStorage.setItem('portal_locale_v1', 'ru');
    }, theme);
    await page.route('**/test-member-avatar.svg', route => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#7557f5"/></svg>',
    }));
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let json: unknown = [];
      if (path === '/api/v1/session/me') json = {
        user, tenant: { id: tenantId, slug: 'test-team' },
        id_profile: { user }, portal_profile: { language: 'ru' },
        available_tenants: [tenant], active_tenant: tenant,
      };
      else if (path === '/api/v1/session/switch-tenant') json = { active_tenant: tenant };
      else if (path === '/api/v1/csrf') json = { csrfToken: 'test-csrf' };
      else if (path === '/api/v1/portal/profiles') json = [
        { tenant_id: tenantId, user_id: userId, first_name: 'Мария', last_name: 'Иванова', created_at: '2026-09-30T12:00:00Z' },
        { tenant_id: tenantId, user_id: otherId, first_name: 'Анна', last_name: 'Петрова', created_at: '2026-09-30T12:00:00Z' },
      ];
      else if (path === '/api/v1/access/admin/roles') json = [
        { id: 34, tenant_id: tenantId, service: 'portal', name: 'owner', permission_keys: [] },
      ];
      else if (path === '/api/v1/access/admin/role-bindings/search') json = [
        { id: 1, tenant_id: tenantId, user_id: userId, role_id: 34, role_name: 'owner', role_service: 'portal', scope_type: 'TENANT', scope_id: tenantId },
      ];
      else if (path.startsWith('/api/v1/personalization/preferences')) {
        await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } });
        return;
      }
      await route.fulfill({ json });
    });
    await page.goto('/t/test-team/tenant-admin?tab=members');
    const ownRow = page.locator('.tenant-admin__mobile-members > button').filter({ hasText: 'Мария Иванова' });
    const otherRow = page.locator('.tenant-admin__mobile-members > button').filter({ hasText: 'Анна Петрова' });
    await expect(ownRow.locator('img')).toHaveAttribute('src', avatar);
    await expect(ownRow.locator('img')).toHaveJSProperty('naturalWidth', 40);
    await expect(otherRow.locator('img')).toHaveCount(0);
    await expect(otherRow).toContainText('АП');
    await page.screenshot({ path: testInfo.outputPath(`member-avatar-${theme}.png`) });
    await ownRow.click();
    await expect(page.locator('.tenant-admin__member-card img')).toHaveAttribute('src', avatar);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Роли', exact: true }).click();
    await page.locator('.tenant-admin__role-item').filter({ hasText: 'Владелец' }).click();
    await page.locator('.tenant-admin--dialog').getByRole('button', { name: 'Участники', exact: true }).click();
    await expect(page.locator('.tenant-admin__role-member img')).toHaveAttribute('src', avatar);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Участники', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(ownRow.locator('img')).toBeVisible();
    expect(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth)).toBe(true);
  });
}
