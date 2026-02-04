export type AchievementStatus = 'draft' | 'published' | 'hidden' | 'active';

export type GrantVisibility = 'public' | 'private';

export type AchievementImageSet = {
  small?: string | null;
  medium?: string | null;
  large?: string | null;
};

export type Achievement = {
  id: string;
  nameI18n: Record<string, string>;
  description: string | null;
  category: string;
  status: AchievementStatus;
  images: AchievementImageSet | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  canEdit?: boolean;
  canPublish?: boolean;
  canHide?: boolean;
};

export type AchievementListResponse = {
  items: Achievement[];
  nextCursor: string | null;
};

export type AchievementCreatePayload = {
  nameI18n: Record<string, string>;
  description?: string | null;
  category: string;
  status?: AchievementStatus;
  images?: AchievementImageSet | null;
};

export type AchievementUpdatePayload = Partial<AchievementCreatePayload>;

export type Category = {
  id: string;
  nameI18n: Record<string, string>;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CategoryCreatePayload = {
  id: string;
  nameI18n: Record<string, string>;
  order?: number;
  isActive?: boolean;
};

export type CategoryUpdatePayload = {
  nameI18n?: Record<string, string>;
  order?: number;
  isActive?: boolean;
};

export type CategoryListResponse = {
  items: Category[];
};

export type Grant = {
  id: string;
  achievementId: string;
  recipientId: string;
  issuerId: string;
  reason: string | null;
  visibility: GrantVisibility;
  createdAt: string;
  revokedAt: string | null;
};

export type GrantCreatePayload = {
  recipientId: string;
  reason?: string | null;
  visibility: GrantVisibility;
};

export type GrantListResponse = {
  items: Grant[];
  nextCursor: string | null;
};
