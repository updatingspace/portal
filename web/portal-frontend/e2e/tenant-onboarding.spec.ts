import { expect, test } from '@playwright/test';

// Run onboarding on the canonical local hostname as well as IP UX tests.
test.use({
  baseURL: `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || '4173'}`,
});

test('creates an account-bound application and enters the approved tenant', async ({
  page,
  context,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('portal_locale_v1', 'ru'),
  );
  let status: 'empty' | 'pending' | 'approved' = 'empty';
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'owner@example.com',
  };
  const tenant = {
    tenant_id: '22222222-2222-4222-8222-222222222222',
    tenant_slug: 'new-team',
    display_name: 'New Team',
    status: 'active',
    base_role: 'owner',
  };
  await context.addCookies([
    {
      name: 'updspace_csrf',
      value: 'test-csrf-token',
      url: 'http://127.0.0.1:4173',
    },
  ]);
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = {};
    if (path === '/api/v1/session/me') {
      response = {
        user,
        tenant: {
          id: tenant.tenant_id,
          slug: status === 'approved' ? tenant.tenant_slug : '',
        },
        capabilities: [],
        id_profile: { user },
        available_tenants: [],
      };
    } else if (path === '/api/v1/entry/me') {
      response = {
        user,
        memberships: status === 'approved' ? [tenant] : [],
        last_tenant: null,
        pending_tenant_applications:
          status === 'pending'
            ? [{ id: 'app-1', slug: tenant.tenant_slug, status: 'pending' }]
            : [],
      };
    } else if (path === '/api/v1/entry/tenant-applications') {
      expect(route.request().postDataJSON()).toEqual({
        slug: 'new-team',
        name: 'New Team',
        description: 'For our friends',
      });
      status = 'pending';
      await route.fulfill({
        status: 201,
        json: { id: 'app-1', slug: 'new-team', status: 'pending' },
      });
      return;
    } else if (path === '/api/v1/session/switch-tenant') {
      expect(route.request().postDataJSON()).toEqual({
        tenant_slug: 'new-team',
      });
      response = { active_tenant: tenant, redirect_to: '/t/new-team/' };
    }
    await route.fulfill({ json: response });
  });
  await page.goto('/choose-tenant');
  await page.getByRole('button', { name: 'Подать заявку' }).click();
  await expect(page.getByLabel('Название', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Email для заявки')).toHaveCount(0);
  await page.getByLabel('Название', { exact: true }).fill('New Team');
  await page.getByLabel('Описание', { exact: true }).fill('For our friends');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await page.getByLabel('Адрес сообщества', { exact: true }).fill('new-team');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await page.getByRole('button', { name: 'Отправить заявку' }).click();
  await expect(
    page.getByText('На рассмотрении', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('new-team', { exact: true })).toBeVisible();
  status = 'approved';
  await page.getByRole('button', { name: 'Обновить статус' }).click();
  await page.getByRole('button', { name: /Открыть сообщество/ }).click();
  await expect(page).toHaveURL(/\/t\/new-team\//);
});

test('system administrator reviews creation without a selected tenant', async ({
  page,
  context,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('portal_locale_v1', 'ru'),
  );
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    master_flags: { system_admin: true },
  };
  const application = {
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'friends',
    name: 'Friends',
    description: 'Our community',
    status: 'pending',
    applicant_user_id: '33333333-3333-4333-8333-333333333333',
  };
  let completed = false;
  await context.addCookies([
    {
      name: 'updspace_csrf',
      value: 'test-csrf-token',
      url: 'http://127.0.0.1:4173',
    },
  ]);
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = {};
    if (path === '/api/v1/session/me')
      response = { user, tenant: null, available_tenants: [] };
    if (path === '/api/v1/entry/me')
      response = {
        user,
        memberships: [],
        pending_tenant_applications: [],
        last_tenant: null,
      };
    if (path === '/api/v1/entry/admin/tenant-applications')
      response = completed ? [] : [application];
    if (path.endsWith(`/${application.id}/approve`)) {
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers()['x-csrf-token']).toBeTruthy();
      if (application.status === 'pending') {
        application.status = 'provisioning';
        await route.fulfill({ status: 202, json: application });
        return;
      }
      completed = true;
      response = { ...application, status: 'approved' };
    }
    await route.fulfill({ json: response });
  });
  await page.goto('/choose-tenant');
  await page.getByRole('button', { name: /Меню аккаунта/ }).click();
  await page.getByText('Рассмотреть заявки', { exact: true }).click();
  await page.getByRole('button', { name: 'Одобрить', exact: true }).click();
  await expect(
    page.getByText('Одобрено. Настраиваем доступ владельцу.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Отклонить', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Повторить настройку доступа' })
    .click();
  await expect(page.getByText('Нет заявок на рассмотрении.')).toBeVisible();
});
