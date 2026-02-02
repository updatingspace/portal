import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchMfaStatus,
  fetchSessions,
  revokeSession,
  type MfaStatus,
  type Session,
} from '../../../../api/account';
import { logger } from '../../../../utils/logger';

type UseSettingsDataResult = {
  sessions: Session[];
  mfaStatus: MfaStatus | null;
  loadingSessions: boolean;
  loadingMfa: boolean;
  sessionsError: Error | null;
  mfaError: Error | null;
  revokingId: string | null;
  refreshSessions: () => Promise<void>;
  refreshMfa: () => Promise<void>;
  revokeActiveSession: (sessionId: string) => Promise<void>;
};

export const useSettingsData = (): UseSettingsDataResult => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMfa, setLoadingMfa] = useState(true);
  const [sessionsError, setSessionsError] = useState<Error | null>(null);
  const [mfaError, setMfaError] = useState<Error | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const loadSessions = useCallback(async () => {
    if (!isMountedRef.current) return;
    setLoadingSessions(true);
    setSessionsError(null);

    try {
      const payload = await fetchSessions();
      if (isMountedRef.current) {
        setSessions(payload);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setSessions([]);
        setSessionsError(error instanceof Error ? error : new Error('Unknown sessions error'));
        logger.warn('Sessions fetch failed', {
          area: 'settings',
          event: 'sessions_load',
          error,
        });
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingSessions(false);
      }
    }
  }, []);

  const loadMfa = useCallback(async () => {
    if (!isMountedRef.current) return;
    setLoadingMfa(true);
    setMfaError(null);

    try {
      const payload = await fetchMfaStatus();
      if (isMountedRef.current) {
        setMfaStatus(payload);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setMfaStatus(null);
        setMfaError(error instanceof Error ? error : new Error('Unknown MFA error'));
        logger.warn('MFA status fetch failed', {
          area: 'settings',
          event: 'mfa_load',
          error,
        });
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingMfa(false);
      }
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    await loadSessions();
  }, [loadSessions]);

  const refreshMfa = useCallback(async () => {
    await loadMfa();
  }, [loadMfa]);

  const revokeActiveSession = useCallback(
    async (sessionId: string) => {
      setRevokingId(sessionId);

      try {
        await revokeSession(sessionId);
        setSessions((previous) => previous.filter((session) => session.id !== sessionId));
      } catch (error) {
        logger.warn('Session revoke failed', {
          area: 'settings',
          event: 'session_revoke',
          sessionId,
          error,
        });
      } finally {
        setRevokingId(null);
      }
    },
    [],
  );

  useEffect(() => {
    (async () => {
      await Promise.all([loadSessions(), loadMfa()]);
    })();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadMfa, loadSessions]);

  return {
    sessions,
    mfaStatus,
    loadingSessions,
    loadingMfa,
    sessionsError,
    mfaError,
    revokingId,
    refreshSessions,
    refreshMfa,
    revokeActiveSession,
  };
};
