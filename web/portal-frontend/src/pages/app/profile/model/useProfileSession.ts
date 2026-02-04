import { useCallback, useEffect, useRef, useState } from 'react';

import { sessionMe, type SessionMe } from '../../../../services/api';
import { logger } from '../../../../utils/logger';

type UseProfileSessionResult = {
  sessionInfo: SessionMe | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

export const useProfileSession = (): UseProfileSessionResult => {
  const [sessionInfo, setSessionInfo] = useState<SessionMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const payload = await sessionMe();
      if (isMountedRef.current) {
        setSessionInfo(payload);
      }
    } catch (nextError) {
      if (isMountedRef.current) {
        if (nextError instanceof Error) {
          logger.warn('Session info load failed', {
            area: 'profile',
            event: 'session_load',
            error: nextError,
          });
          setError(nextError);
        } else {
          setError(new Error('Unknown session error'));
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // React StrictMode mounts/unmounts twice in dev.
    // Reset the mounted flag on each effect run so refresh can set state.
    isMountedRef.current = true;
    void refresh();

    return () => {
      isMountedRef.current = false;
    };
  }, [refresh]);

  return {
    sessionInfo,
    isLoading,
    error,
    refresh,
  };
};
