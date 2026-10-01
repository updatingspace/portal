import type { Page } from '@playwright/test';
export const memberships = ['alpha', 'beta'].map((slug, index) => ({
  tenant_id: `00000000-0000-4000-8000-00000000000${index}`,
  tenant_slug: slug,
  display_name: slug === 'alpha' ? 'Альфа' : 'Бета',
  status: 'active',
  base_role: 'member',
}));
const permissions = [
  'activity.feed.read',
  'events.event.read',
  'voting.poll.read',
  'gamification.achievements.read',
  'portal.profile.read_self',
  'activity.news.create',
];
export async function locale(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('portal_locale_v1', 'ru');
  });
}
export async function session(
  page: Page,
  noMembership = false,
  organizer = false,
) {
  let current = memberships[0];
  await locale(page);
  await page.context().addCookies([
    {
      name: 'updspace_csrf',
      value: 'test-only',
      url: 'http://127.0.0.1:4173',
    },
  ]);
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith('/session/switch-tenant')) {
      current = memberships.find(
        (m) => m.tenant_slug === route.request().postDataJSON().tenant_slug,
      )!;
      data = { active_tenant: current };
    } else if (path.endsWith('/session/me'))
      data = {
        user: { id: '11111111-1111-4111-8111-111111111111' },
        tenant: noMembership
          ? null
          : { id: current.tenant_id, slug: current.tenant_slug },
        portal_profile: { display_name: 'Игрок', language: 'ru' },
        capabilities: organizer
          ? [
              ...permissions,
              'events.event.create',
              'events.event.manage',
              'events.rsvp.set',
            ]
          : permissions,
      };
    else if (path.endsWith('/entry/me'))
      data = {
        user: { id: '11111111-1111-4111-8111-111111111111' },
        memberships: noMembership ? [] : memberships,
        last_tenant: null,
        pending_tenant_applications: [],
      };
    else if (path.endsWith('/session/tenants')) data = memberships;
    else if (path.includes('/personalization/preferences')) {
      await route.fulfill({
        status: 503,
        json: { error: { code: 'UNAVAILABLE', message: 'Unavailable' } },
      });
      return;
    } else if (
      path === '/api/v1/events/events/' ||
      path === '/api/v1/events/events/'
    )
      data = {
        items: [
          {
            id: 'event-1',
            title: `${current.display_name}: встреча`,
            startsAt: '2027-01-01T12:00:00Z',
            endsAt: '2027-01-01T14:00:00Z',
            visibility: 'public',
            scopeType: 'TENANT',
            scopeId: current.tenant_id,
            tenantId: current.tenant_id,
            createdBy: '11111111-1111-4111-8111-111111111111',
            rsvpCounts: { going: 0, interested: 0, not_going: 0 },
            myRsvp: null,
          },
        ],
        meta: { total: 1, limit: 20, offset: 0 },
      };
    else if (path === '/api/v1/events/events/event-1')
      data = {
        id: 'event-1',
        title: 'Встреча сообщества',
        startsAt: '2027-01-01T12:00:00Z',
        endsAt: '2027-01-01T14:00:00Z',
        visibility: 'public',
        scopeType: 'TENANT',
        scopeId: current.tenant_id,
        tenantId: current.tenant_id,
        createdBy: '11111111-1111-4111-8111-111111111111',
        rsvpCounts: { going: 1, interested: 0, not_going: 0 },
        myRsvp: 'going',
      };
    else if (path.includes('/activity/v2/feed'))
      data = { items: [], has_more: false, next_cursor: null };
    else if (path.includes('/activity/v2/subscriptions')) data = { items: [] };
    else if (path.includes('/activity/v2/unread')) data = { count: 0 };
    else if (path.includes('/gamification/categories')) data = { items: [] };
    else if (path.includes('/voting/polls'))
      data = { items: [], pagination: { total: 0, limit: 3, offset: 0 } };
    else if (path.includes('/gamification/achievements'))
      data = { items: [], next_cursor: null };
    await route.fulfill({ json: data });
  });
}
