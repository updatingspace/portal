import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAchievement,
  listAchievements,
  listGrants,
  updateAchievement,
  createGrant,
} from './gamification';

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe('gamification api mapping', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    document.cookie = 'updspace_csrf=test-token; path=/';
  });

  afterEach(() => {
    document.cookie = 'updspace_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('maps listAchievements and keeps query contract', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: 'a1',
            name_i18n: { ru: 'Тест' },
            description: null,
            category: 'battle',
            status: 'published',
            images: { small: 's.png' },
            created_by: 'u1',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
            can_edit: true,
            can_publish: true,
            can_hide: false,
          },
        ],
        next_cursor: 'next-1',
      }),
      clone() {
        return this;
      },
      headers: new Headers(),
    });

    const result = await listAchievements({
      status: ['published'],
      category: ['battle'],
      q: 'тест',
      created_by: 'me',
      limit: 20,
      cursor: 'c1',
    });

    expect(result.nextCursor).toBe('next-1');
    expect(result.items[0]).toMatchObject({
      id: 'a1',
      status: 'published',
      category: 'battle',
      canEdit: true,
      canPublish: true,
      canHide: false,
    });
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/gamification/achievements?');
    expect(fetchMock.mock.calls[0][0]).toContain('status=published');
    expect(fetchMock.mock.calls[0][0]).toContain('category=battle');
    expect(fetchMock.mock.calls[0][0]).toContain('created_by=me');
  });

  it('sends normalized payload for create/update achievement', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'a-created',
        name_i18n: { ru: 'Создано' },
        description: 'd',
        category: 'events',
        status: 'draft',
        images: {},
      }),
      clone() {
        return this;
      },
      headers: new Headers(),
    });

    await createAchievement({
      nameI18n: { ru: 'Создано' },
      category: 'events',
      description: 'd',
      status: 'draft',
      images: { small: 's' },
    });

    const createOptions = fetchMock.mock.calls[0][1];
    expect(createOptions.body).toContain('"name_i18n"');
    expect(createOptions.body).toContain('"category":"events"');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'a-created', name_i18n: { ru: 'Обновлено' } }),
      clone() {
        return this;
      },
      headers: new Headers(),
    });

    await updateAchievement('a-created', {
      nameI18n: { ru: 'Обновлено' },
      status: 'hidden',
    });

    const updateOptions = fetchMock.mock.calls[1][1];
    expect(updateOptions.method).toBe('PATCH');
    expect(updateOptions.body).toContain('"status":"hidden"');
  });

  it('maps grants list and createGrant payload', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: 'g1',
            achievement_id: 'a1',
            recipient_id: 'u2',
            issuer_id: 'u1',
            reason: null,
            visibility: 'private',
            created_at: '2026-01-10T00:00:00Z',
            revoked_at: null,
          },
        ],
        next_cursor: null,
      }),
      clone() {
        return this;
      },
      headers: new Headers(),
    });

    const listResult = await listGrants('a1', { visibility: 'private', limit: 10 });
    expect(listResult.items[0]).toMatchObject({
      id: 'g1',
      achievementId: 'a1',
      recipientId: 'u2',
      visibility: 'private',
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'g2',
        achievement_id: 'a1',
        recipient_id: 'u3',
        issuer_id: 'u1',
        reason: 'great',
        visibility: 'public',
        created_at: '2026-01-11T00:00:00Z',
        revoked_at: null,
      }),
      clone() {
        return this;
      },
      headers: new Headers(),
    });

    await createGrant('a1', { recipientId: 'u3', reason: 'great', visibility: 'public' });
    const createGrantBody = fetchMock.mock.calls[1][1].body;
    expect(createGrantBody).toContain('"recipient_id":"u3"');
    expect(createGrantBody).toContain('"visibility":"public"');
  });
});
