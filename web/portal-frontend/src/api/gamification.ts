import { request } from './client';
import type {
  Achievement,
  AchievementCreatePayload,
  AchievementListResponse,
  AchievementUpdatePayload,
  Category,
  CategoryCreatePayload,
  CategoryListResponse,
  CategoryUpdatePayload,
  Grant,
  GrantCreatePayload,
  GrantListResponse,
} from '../types/gamification';

type RawAchievement = {
  id: string;
  name_i18n?: Record<string, string>;
  description?: string | null;
  category?: string;
  status?: string;
  images?: {
    small?: string | null;
    medium?: string | null;
    large?: string | null;
  } | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  can_edit?: boolean;
  can_publish?: boolean;
  can_hide?: boolean;
};

type RawCategory = {
  id: string;
  name_i18n?: Record<string, string>;
  order?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

type RawGrant = {
  id: string;
  achievement_id: string;
  recipient_id: string;
  issuer_id: string;
  reason?: string | null;
  visibility?: string;
  created_at?: string;
  revoked_at?: string | null;
};

const mapAchievement = (raw: RawAchievement): Achievement => ({
  id: raw.id,
  nameI18n: raw.name_i18n ?? {},
  description: raw.description ?? null,
  category: raw.category ?? '',
  status: (raw.status ?? 'draft') as Achievement['status'],
  images: raw.images ?? null,
  createdBy: raw.created_by ?? '',
  createdAt: raw.created_at ?? '',
  updatedAt: raw.updated_at ?? '',
  canEdit: raw.can_edit,
  canPublish: raw.can_publish,
  canHide: raw.can_hide,
});

const mapCategory = (raw: RawCategory): Category => ({
  id: raw.id,
  nameI18n: raw.name_i18n ?? {},
  order: typeof raw.order === 'number' ? raw.order : 0,
  isActive: raw.is_active ?? true,
  createdAt: raw.created_at ?? '',
  updatedAt: raw.updated_at ?? '',
});

const mapGrant = (raw: RawGrant): Grant => ({
  id: raw.id,
  achievementId: raw.achievement_id,
  recipientId: raw.recipient_id,
  issuerId: raw.issuer_id,
  reason: raw.reason ?? null,
  visibility: (raw.visibility ?? 'public') as Grant['visibility'],
  createdAt: raw.created_at ?? '',
  revokedAt: raw.revoked_at ?? null,
});

const buildQueryString = (params?: Record<string, string | number | undefined | null>): string => {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

export const listAchievements = async (params?: {
  status?: string[];
  category?: string[];
  q?: string;
  created_by?: 'me' | 'any';
  limit?: number;
  cursor?: string;
}): Promise<AchievementListResponse> => {
  const suffix = buildQueryString({
    status: params?.status?.join(','),
    category: params?.category?.join(','),
    q: params?.q,
    created_by: params?.created_by,
    limit: params?.limit,
    cursor: params?.cursor,
  });
  const data = await request<{ items: RawAchievement[]; next_cursor: string | null }>(
    `/gamification/achievements${suffix}`,
  );
  return {
    items: data.items.map(mapAchievement),
    nextCursor: data.next_cursor,
  };
};

export const getAchievement = async (id: string): Promise<Achievement> => {
  const data = await request<RawAchievement>(`/gamification/achievements/${id}`);
  return mapAchievement(data);
};

export const createAchievement = async (payload: AchievementCreatePayload): Promise<Achievement> => {
  const data = await request<RawAchievement>('/gamification/achievements', {
    method: 'POST',
    body: {
      name_i18n: payload.nameI18n,
      description: payload.description ?? '',
      category: payload.category,
      status: payload.status ?? 'draft',
      images: payload.images ?? {},
    },
  });
  return mapAchievement(data);
};

export const updateAchievement = async (
  id: string,
  payload: AchievementUpdatePayload,
): Promise<Achievement> => {
  const data = await request<RawAchievement>(`/gamification/achievements/${id}`, {
    method: 'PATCH',
    body: {
      name_i18n: payload.nameI18n,
      description: payload.description,
      category: payload.category,
      status: payload.status,
      images: payload.images,
    },
  });
  return mapAchievement(data);
};

export const listCategories = async (): Promise<CategoryListResponse> => {
  const data = await request<{ items: RawCategory[] }>('/gamification/categories');
  return { items: data.items.map(mapCategory) };
};

export const createCategory = async (payload: CategoryCreatePayload): Promise<Category> => {
  const data = await request<RawCategory>('/gamification/categories', {
    method: 'POST',
    body: {
      id: payload.id,
      name_i18n: payload.nameI18n,
      order: payload.order ?? 0,
      is_active: payload.isActive ?? true,
    },
  });
  return mapCategory(data);
};

export const updateCategory = async (
  id: string,
  payload: CategoryUpdatePayload,
): Promise<Category> => {
  const data = await request<RawCategory>(`/gamification/categories/${id}`, {
    method: 'PATCH',
    body: {
      name_i18n: payload.nameI18n,
      order: payload.order,
      is_active: payload.isActive,
    },
  });
  return mapCategory(data);
};

export const listGrants = async (
  achievementId: string,
  params?: { visibility?: string; limit?: number; cursor?: string },
): Promise<GrantListResponse> => {
  const suffix = buildQueryString({
    visibility: params?.visibility,
    limit: params?.limit,
    cursor: params?.cursor,
  });
  const data = await request<{ items: RawGrant[]; next_cursor: string | null }>(
    `/gamification/achievements/${achievementId}/grants${suffix}`,
  );
  return {
    items: data.items.map(mapGrant),
    nextCursor: data.next_cursor,
  };
};

export const createGrant = async (
  achievementId: string,
  payload: GrantCreatePayload,
): Promise<Grant> => {
  const data = await request<RawGrant>(`/gamification/achievements/${achievementId}/grants`, {
    method: 'POST',
    body: {
      recipient_id: payload.recipientId,
      reason: payload.reason ?? '',
      visibility: payload.visibility,
    },
  });
  return mapGrant(data);
};

export const revokeGrant = async (grantId: string): Promise<Grant> => {
  const data = await request<RawGrant>(`/gamification/grants/${grantId}/revoke`, {
    method: 'POST',
  });
  return mapGrant(data);
};
