import { useCallback, useEffect, useState } from 'react';

import { notifyApiError } from '../../utils/apiErrorHandling';
import { createFeatureFlag, listFeatureFlags, updateFeatureFlag, type FeatureFlag, type FeatureFlagInput } from './api';

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFeatureFlags();
      setFlags(data);
    } catch (error) {
      notifyApiError(error, 'Не удалось загрузить feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(async (payload: FeatureFlagInput) => {
    const created = await createFeatureFlag(payload);
    setFlags((prev) => [...prev.filter((item) => item.key !== created.key), created].sort((a, b) => a.key.localeCompare(b.key)));
    return created;
  }, []);

  const patch = useCallback(async (key: string, payload: Partial<Pick<FeatureFlagInput, 'description' | 'enabled' | 'rollout'>>) => {
    const updated = await updateFeatureFlag(key, payload);
    setFlags((prev) => prev.map((item) => (item.key === updated.key ? updated : item)));
    return updated;
  }, []);

  return { flags, loading, reload, create, patch };
};
