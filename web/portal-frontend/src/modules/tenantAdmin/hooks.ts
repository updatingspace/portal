import { useCallback, useEffect, useState } from 'react';

import { notifyApiError } from '../../utils/apiErrorHandling';
import {
  listPermissionCatalog,
  listTenantAdminEvents,
  listTenantMembers,
  listTenantRoles,
  searchRoleBindings,
  type PermissionEntry,
  type ScopeType,
  type TenantAdminEvent,
  type TenantBinding,
  type TenantMember,
  type TenantRole,
} from './api';

export const useTenantRoles = (params: { query?: string; service?: string; limit?: number } = {}) => {
  const { query, service, limit = 200 } = params;
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTenantRoles({ query, service, limit });
      setRoles(data);
    } catch (error) {
      notifyApiError(error, 'Не удалось получить роли');
    } finally {
      setLoading(false);
    }
  }, [query, service, limit]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { roles, loading, reload };
};

export const useRoleBindings = (params: {
  q?: string;
  scopeType?: ScopeType;
  scopeId?: string;
  userId?: string;
  limit?: number;
  enabled?: boolean;
} = {}) => {
  const { q, scopeType, scopeId, userId, limit = 50, enabled = true } = params;
  const [bindings, setBindings] = useState<TenantBinding[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await searchRoleBindings({
        q,
        scope_type: scopeType,
        scope_id: scopeId,
        user_id: userId,
        limit,
      });
      setBindings(data);
    } catch (error) {
      notifyApiError(error, 'Не удалось получить назначения ролей');
    } finally {
      setLoading(false);
    }
  }, [q, scopeType, scopeId, userId, limit]);

  useEffect(() => {
    if (enabled) {
      reload();
    }
  }, [enabled, reload]);

  return { bindings, loading: enabled ? loading : false, reload };
};

export const useTenantAdminEvents = (limit = 20) => {
  const [events, setEvents] = useState<TenantAdminEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTenantAdminEvents(limit);
      setEvents(data);
    } catch (error) {
      notifyApiError(error, 'Не удалось получить историю изменений');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { events, loading, reload };
};

export const useTenantMembers = (params: { query?: string; limit?: number } = {}) => {
  const { query, limit = 200 } = params;
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTenantMembers({ query, limit });
      setMembers(data);
    } catch (error) {
      notifyApiError(error, 'Не удалось получить список участников');
    } finally {
      setLoading(false);
    }
  }, [query, limit]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { members, loading, reload };
};

export const usePermissionCatalog = (service?: string) => {
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPermissionCatalog(service);
      setPermissions(data);
    } catch (error) {
      notifyApiError(error, 'Не удалось загрузить каталог прав');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { permissions, loading, reload };
};
