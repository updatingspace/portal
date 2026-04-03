import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ request: vi.fn() }));
import { request } from './client';
import {
  createAchievement,
  createCategory,
  createGrant,
  getAchievement,
  listAchievements,
  listCategories,
  listGrants,
  revokeGrant,
  updateAchievement,
  updateCategory,
} from './gamification';

describe('gamification api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps achievements list, defaults and query params', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      items: [
        {
          id: 'a1',
          status: 'published',
          name_i18n: { ru: 'A1' },
          category: 'cat',
          images: null,
          created_by: 'u1',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
          can_edit: true,
        },
        {
          id: 'a2',
        },
      ],
      next_cursor: 'next',
    });

    const result = await listAchievements({
      status: ['published'],
      category: ['cat'],
      q: 'qq',
      created_by: 'me',
      limit: 10,
      cursor: 'c1',
    });

    expect(request).toHaveBeenCalledWith(
      '/gamification/achievements?status=published&category=cat&q=qq&created_by=me&limit=10&cursor=c1',
    );
    expect(result.nextCursor).toBe('next');
    expect(result.items[0]).toMatchObject({
      id: 'a1',
      status: 'published',
      canEdit: true,
    });
    expect(result.items[1]).toMatchObject({
      nameI18n: {},
      category: '',
      status: 'draft',
      images: null,
      createdBy: '',
      createdAt: '',
      updatedAt: '',
    });
  });

  it('maps single achievement and create/update payloads', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({ id: 'a1', name_i18n: { ru: 'A1' }, status: 'active' })
      .mockResolvedValueOnce({ id: 'a2', name_i18n: { ru: 'New' } })
      .mockResolvedValueOnce({ id: 'a2', name_i18n: { ru: 'Upd' }, status: 'hidden' });

    await expect(getAchievement('a1')).resolves.toMatchObject({ id: 'a1', status: 'active' });

    await createAchievement({
      nameI18n: { ru: 'New' },
      category: 'cat',
      status: 'draft',
      images: { small: 's' },
      description: 'd',
    });
    await updateAchievement('a2', { status: 'hidden' });

    expect(request).toHaveBeenNthCalledWith(2, '/gamification/achievements', {
      method: 'POST',
      body: {
        name_i18n: { ru: 'New' },
        description: 'd',
        category: 'cat',
        status: 'draft',
        images: { small: 's' },
      },
    });
    expect(request).toHaveBeenNthCalledWith(3, '/gamification/achievements/a2', {
      method: 'PATCH',
      body: {
        name_i18n: undefined,
        description: undefined,
        category: undefined,
        status: 'hidden',
        images: undefined,
      },
    });
  });

  it('maps categories and category mutations', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({
        items: [{ id: 'c1' }, { id: 'c2', name_i18n: { ru: 'C2' }, order: 3, is_active: false }],
      })
      .mockResolvedValueOnce({ id: 'c3', name_i18n: { ru: 'C3' } })
      .mockResolvedValueOnce({ id: 'c2', name_i18n: { ru: 'C2u' }, order: 7, is_active: true });

    const listed = await listCategories();
    await createCategory({ id: 'c3', nameI18n: { ru: 'C3' } });
    await updateCategory('c2', { order: 7, isActive: true });

    expect(listed.items[0]).toMatchObject({ order: 0, isActive: true });
    expect(listed.items[1]).toMatchObject({ order: 3, isActive: false });
    expect(request).toHaveBeenNthCalledWith(2, '/gamification/categories', {
      method: 'POST',
      body: {
        id: 'c3',
        name_i18n: { ru: 'C3' },
        order: 0,
        is_active: true,
      },
    });
    expect(request).toHaveBeenNthCalledWith(3, '/gamification/categories/c2', {
      method: 'PATCH',
      body: {
        name_i18n: undefined,
        order: 7,
        is_active: true,
      },
    });
  });

  it('maps grants list/create/revoke and query filtering', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({
        items: [{ id: 'g1', achievement_id: 'a1', recipient_id: 'u1', issuer_id: 'adm' }, { id: 'g2', achievement_id: 'a1', recipient_id: 'u2', issuer_id: 'adm', visibility: 'private', reason: 'r' }],
        next_cursor: null,
      })
      .mockResolvedValueOnce({
        id: 'g3',
        achievement_id: 'a1',
        recipient_id: 'u3',
        issuer_id: 'adm',
        visibility: 'public',
      })
      .mockResolvedValueOnce({
        id: 'g3',
        achievement_id: 'a1',
        recipient_id: 'u3',
        issuer_id: 'adm',
        revoked_at: '2026-02-01T00:00:00Z',
      });

    const listed = await listGrants('a1', { visibility: 'private', limit: 5, cursor: 'n' });
    await createGrant('a1', { recipientId: 'u3', visibility: 'public' });
    const revoked = await revokeGrant('g3');

    expect(request).toHaveBeenNthCalledWith(1, '/gamification/achievements/a1/grants?visibility=private&limit=5&cursor=n');
    expect(listed.items[0]).toMatchObject({ visibility: 'public', reason: null, revokedAt: null });
    expect(listed.items[1]).toMatchObject({ visibility: 'private', reason: 'r' });
    expect(request).toHaveBeenNthCalledWith(2, '/gamification/achievements/a1/grants', {
      method: 'POST',
      body: {
        recipient_id: 'u3',
        reason: '',
        visibility: 'public',
      },
    });
    expect(request).toHaveBeenNthCalledWith(3, '/gamification/grants/g3/revoke', { method: 'POST' });
    expect(revoked.revokedAt).toBe('2026-02-01T00:00:00Z');
  });
});
