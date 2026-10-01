import { expect, test } from '@playwright/test';

test.use({
  baseURL: `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || '4173'}`,
  viewport: { width: 1440, height: 1100 },
});

for (const theme of ['light', 'dark'] as const) {
  test(`administration uses readable descriptions in ${theme} theme`, async ({
    page,
  }, testInfo) => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const tenantId = '22222222-2222-4222-8222-222222222222';
    const user = {
      language: 'ru',
      id: userId,
      display_name: 'Мария Иванова',
      master_flags: { system_admin: true },
    };
    const tenant = {
      tenant_id: tenantId,
      tenant_slug: 'test-team',
      display_name: 'Команда',
      status: 'active',
      base_role: 'owner',
    };
    await page.addInitScript(
      (mode) => localStorage.setItem('updspace-theme', mode),
      theme,
    );
    await page.context().addCookies([
      {
        name: 'updspace_csrf',
        value: 'test-csrf',
        url: 'http://127.0.0.1:4173',
      },
    ]);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      let json: unknown = [];
      if (path === '/api/v1/session/me')
        json = {
          user,
          tenant: { id: tenantId, slug: 'test-team' },
          id_profile: { user },
          portal_profile: { display_name: 'Мария Иванова', language: 'ru' },
          available_tenants: [tenant],
          active_tenant: tenant,
        };
      else if (path === '/api/v1/session/switch-tenant')
        json = { active_tenant: tenant };
      else if (path.startsWith('/api/v1/personalization/preferences')) {
        await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } });
        return;
      } else if (path === '/api/v1/access/admin/roles')
        json = [
          {
            id: 34,
            tenant_id: tenantId,
            service: 'portal',
            name: 'owner',
            permission_keys: ['portal.roles.write'],
          },
          {
            id: 2,
            tenant_id: null,
            service: 'portal',
            name: 'member',
            permission_keys: ['portal.profile.read_self'],
          },
        ];
      else if (path === '/api/v1/portal/profiles')
        json = [
          {
            tenant_id: tenantId,
            user_id: userId,
            first_name: 'Мария',
            last_name: 'Иванова',
            created_at: '2026-09-30T12:00:00Z',
            updated_at: '2026-09-30T12:00:00Z',
          },
        ];
      else if (path === '/api/v1/access/permissions')
        json = [
          {
            key: 'portal.roles.write',
            service: 'portal',
            description: 'Create/update roles for a service',
          },
        ];
      else if (path === '/api/v1/access/admin/events')
        json = [
          {
            id: 'event-1',
            action: 'tenant_owner_provisioned',
            target_type: 'binding',
            target_id: '27',
            performed_by: userId,
            metadata: { user_id: userId, role_id: '34' },
            created_at: '2026-09-30T16:53:00Z',
          },
        ];
      await route.fulfill({ json });
    });
    await page.addInitScript(() =>
      localStorage.setItem('portal_locale_v1', 'ru'),
    );
    await page.goto('/t/test-team/tenant-admin?tab=roles');
    await expect(
      page.getByRole('heading', { name: 'Управление сообществом' }),
    ).toBeVisible();
    await page
      .locator('.tenant-admin__role-item')
      .filter({ hasText: 'Владелец' })
      .click();
    await expect(page.getByText('Выбрана роль: Владелец')).toBeVisible();
    await expect(
      page.getByText('Создавать и изменять роли', { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('.tenant-admin__role-overview input'),
    ).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(`roles-${theme}.png`),
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'Редактировать', exact: true })
      .click();
    await expect(
      page.locator('.tenant-admin__role-overview input').first(),
    ).toBeVisible();
    const roleName = page.locator('.tenant-admin__role-overview input').first();
    await roleName.fill('Сохранить ввод при повороте экрана');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(roleName).toHaveValue('Сохранить ввод при повороте экрана');
    await page.setViewportSize({ width: 1440, height: 1100 });
    await expect(roleName).toHaveValue('Сохранить ввод при повороте экрана');
    await page.getByRole('button', { name: 'Отменить', exact: true }).click();
    await expect(
      page.locator('.tenant-admin__role-overview input'),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Аудит', exact: true }).click();
    await expect(page).toHaveURL(/tab=audit/);
    await expect(
      page.getByRole('heading', { name: 'Предоставлен доступ владельцу' }),
    ).toBeVisible();
    await expect(
      page.getByText('Владелец: Мария Иванова. Раздел: Сообщество.'),
    ).toBeVisible();
    await expect(page.getByText('Изменил: Мария Иванова')).toBeVisible();
    await expect(
      page.getByText('tenant_owner_provisioned', { exact: true }),
    ).not.toBeVisible();
    await expect(
      page.locator('.tenant-admin__technical-details pre'),
    ).not.toBeVisible();
    await page.getByText('Технические данные', { exact: true }).click();
    await expect(
      page.getByText('tenant_owner_provisioned', { exact: true }),
    ).toBeVisible();
    await page.getByText('Технические данные', { exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath(`audit-${theme}.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 720, height: 1000 });
    await expect(page.locator('.tenant-admin__audit-item')).toBeVisible();
    expect(
      await page
        .locator('.tenant-admin')
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.reload();
    await expect(page.locator('.tenant-admin__audit-item')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
