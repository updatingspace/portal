import type { Page } from '@playwright/test';
import { memberships, session } from './portal';

export const auditUser = '11111111-1111-4111-8111-111111111111';
export const auditPoll = {
  id: 'poll-1',
  tenant_id: memberships[0].tenant_id,
  title: 'Выбираем игру для встречи',
  description: 'В эту пятницу играем вместе. Выберите удобный вариант.',
  scope_type: 'TENANT',
  scope_id: memberships[0].tenant_id,
  visibility: 'public',
  status: 'active',
  allow_revoting: true,
  anonymous: false,
  results_visibility: 'always',
  created_by: auditUser,
  created_at: '2026-09-01T12:00:00Z',
  updated_at: '2026-09-01T12:00:00Z',
  starts_at: null,
  ends_at: '2027-10-01T12:00:00Z',
  settings: {},
};
export const auditAchievement = {
  id: 'award-1',
  name_i18n: { ru: 'Вместе до победы' },
  description: 'За помощь команде на встречах сообщества.',
  category: 'teamwork',
  status: 'published',
  images: null,
  created_by: auditUser,
  created_at: '2026-09-01T12:00:00Z',
  updated_at: '2026-09-01T12:00:00Z',
  can_edit: true,
  can_publish: true,
  can_hide: true,
};
export async function extendedSession(page: Page, manager = true) {
  await session(page, false, true);
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown;
    if (path.endsWith('/session/me') && manager)
      json = {
        user: { id: auditUser, master_flags: { system_admin: true } },
        tenant: { id: memberships[0].tenant_id, slug: 'alpha' },
        portal_profile: { display_name: 'Игрок', language: 'ru' },
      };
    else if (path === '/api/v1/voting/polls/templates')
      json = [
        {
          slug: 'game',
          title: 'Выбор игры',
          description: 'Один вопрос с вариантами игр.',
          visibility: 'public',
          settings: {},
          questions: [],
        },
      ];
    else if (path === '/api/v1/voting/polls')
      json = {
        items: [
          {
            ...auditPoll,
            status:
              new URL(route.request().url()).searchParams.get('status') ||
              auditPoll.status,
          },
        ],
        pagination: { total: 1, limit: 20, offset: 0 },
      };
    else if (path === '/api/v1/voting/polls/poll-1/info')
      json = {
        poll: auditPoll,
        nominations: [
          {
            id: 'question-1',
            poll_id: 'poll-1',
            title: 'Во что играем?',
            kind: 'custom',
            max_votes: 1,
            sort_order: 0,
          },
        ],
        options: ['Minecraft', 'Deep Rock Galactic'].map((text, index) => ({
          id: `option-${index}`,
          nomination_id: 'question-1',
          text,
          sort_order: index,
        })),
        meta: {
          can_vote: true,
          has_voted: false,
          total_votes: 4,
          total_participants: 4,
        },
      };
    else if (path === '/api/v1/voting/polls/poll-1') json = auditPoll;
    else if (path.endsWith('/poll-1/results'))
      json = {
        poll_id: 'poll-1',
        total_votes: 4,
        nominations: [
          {
            nomination_id: 'question-1',
            title: 'Во что играем?',
            options: [
              { option_id: 'option-0', text: 'Minecraft', votes: 2 },
              { option_id: 'option-1', text: 'Deep Rock Galactic', votes: 2 },
            ],
          },
        ],
      };
    else if (path.startsWith('/api/v1/voting/')) json = [];
    else if (path === '/api/v1/gamification/achievements')
      json = { items: [auditAchievement], next_cursor: null };
    else if (path === '/api/v1/gamification/achievements/award-1')
      json = auditAchievement;
    else if (path.endsWith('/award-1/grants'))
      json = {
        items: [
          {
            id: 'grant-1',
            achievement_id: 'award-1',
            recipient_id: auditUser,
            issuer_id: auditUser,
            reason: 'Помощь новичкам',
            visibility: 'public',
            created_at: '2026-09-25T12:00:00Z',
          },
        ],
        next_cursor: null,
      };
    else if (path === '/api/v1/gamification/categories')
      json = {
        items: [
          {
            id: 'teamwork',
            name_i18n: { ru: 'Командная игра' },
            is_active: true,
            order: 0,
          },
        ],
      };
    else if (path === '/api/v1/access/admin/roles')
      json = [
        {
          id: 1,
          tenant_id: memberships[0].tenant_id,
          service: 'events',
          name: 'Организатор встреч',
          permission_keys: ['events.event.manage'],
        },
      ];
    else if (path === '/api/v1/access/permissions')
      json = [
        {
          key: 'events.event.manage',
          service: 'events',
          description: 'Управление событиями сообщества',
        },
      ];
    else if (path === '/api/v1/access/admin/events')
      json = [
        {
          id: 'audit-1',
          action: 'role.created',
          target_type: 'role',
          target_id: '1',
          metadata: {},
          performed_by: auditUser,
          created_at: '2026-09-25T12:00:00Z',
        },
      ];
    else if (path === '/api/v1/portal/profiles')
      json = [
        {
          tenant_id: memberships[0].tenant_id,
          user_id: auditUser,
          display_name: 'Игрок',
          first_name: 'Игрок',
          username: 'player',
          created_at: '2026-09-01T12:00:00Z',
          updated_at: '2026-09-01T12:00:00Z',
        },
      ];
    else if (path.includes('feature-flags'))
      json = [
        { key: 'calendar', description: 'Календарь сообщества', enabled: true },
      ];
    else {
      await route.fallback();
      return;
    }
    await route.fulfill({ json });
  });
}
