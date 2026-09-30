import { useCallback, useEffect, useState } from 'react';

import { createFeatureFlag, listFeatureFlags, updateFeatureFlag, type FeatureFlag, type FeatureFlagInput } from './api';

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listFeatureFlags();
      setFlags(data);
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Не удалось загрузить функции.'));
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

  return { flags, loading, error, reload, create, patch };
};
