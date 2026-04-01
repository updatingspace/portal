import { request } from '../../api/client';

export type FeatureFlag = {
  key: string;
  description?: string | null;
  enabled: boolean;
  rollout: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type FeatureFlagInput = {
  key: string;
  description?: string;
  enabled: boolean;
  rollout: number;
};

export const listFeatureFlags = async (): Promise<FeatureFlag[]> =>
  request<FeatureFlag[]>('/feature-flags/flags');

export const createFeatureFlag = async (payload: FeatureFlagInput): Promise<FeatureFlag> =>
  request<FeatureFlag>('/feature-flags/flags', { method: 'POST', body: payload });

export const updateFeatureFlag = async (
  key: string,
  payload: Partial<Pick<FeatureFlagInput, 'description' | 'enabled' | 'rollout'>>,
): Promise<FeatureFlag> =>
  request<FeatureFlag>(`/feature-flags/flags/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: payload,
  });
