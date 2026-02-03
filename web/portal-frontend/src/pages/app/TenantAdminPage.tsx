import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Icon,
  Label,
  Loader,
  Select,
  Switch,
  Table,
  TextInput,
  type SelectOption,
  type TableColumnConfig,
} from '@gravity-ui/uikit';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Plus from '@gravity-ui/icons/Plus';
import Person from '@gravity-ui/icons/Person';
import Shield from '@gravity-ui/icons/Shield';
import ListCheck from '@gravity-ui/icons/ListCheck';
import Pulse from '@gravity-ui/icons/Pulse';

import { useAuth } from '../../contexts/AuthContext';
import { StatusView } from '../../modules/portal/components/StatusView';
import { can } from '../../features/rbac/can';
import { toaster } from '../../toaster';
import { notifyApiError } from '../../utils/apiErrorHandling';
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue';
import {
  SCOPE_TYPES,
  createRoleBinding,
  createTenantRole,
  deleteRoleBinding,
  deleteTenantRole,
  updateTenantRole,
} from '../../modules/tenantAdmin/api';
import type {
  PermissionEntry,
  ScopeType,
  TenantBinding,
  TenantMember,
  TenantRole,
} from '../../modules/tenantAdmin/api';
import {
  usePermissionCatalog,
  useRoleBindings,
  useTenantAdminEvents,
  useTenantMembers,
  useTenantRoles,
} from '../../modules/tenantAdmin/hooks';

const ROLE_COLOR_PALETTE = [
  '#FF7A59',
  '#FFB648',
  '#FFD166',
  '#8DD28A',
  '#42C6A6',
  '#3FA9F5',
  '#7C7CE6',
  '#B87CE6',
  '#F17CC1',
  '#ED6A5A',
];

const SCOPE_LABELS: Record<ScopeType, string> = {
  GLOBAL: 'Глобальный',
  TENANT: 'Тенант',
  COMMUNITY: 'Сообщество',
  TEAM: 'Команда',
  SERVICE: 'Сервис',
};

const ROLE_SCOPE_OPTIONS: Array<{ value: 'all' | 'tenant' | 'template'; content: string }> = [
  { value: 'all', content: 'Все роли' },
  { value: 'tenant', content: 'Роли тенанта' },
  { value: 'template', content: 'Шаблоны системы' },
];

type TabKey = 'members' | 'roles' | 'permissions' | 'audit';

type RolePanelTab = 'overview' | 'permissions' | 'members';

type RoleFormMode = 'create' | 'edit' | 'clone';

type MemberRow = {
  id: string;
  displayName: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  initials: string;
};

type RolePermissionGroup = {
  service: string;
  resources: Array<{
    resource: string;
    items: PermissionEntry[];
  }>;
};

const TAB_OPTIONS: Array<{
  id: TabKey;
  label: string;
  description: string;
  icon: typeof Person;
}> = [
  {
    id: 'roles',
    label: 'Роли',
    description: 'Иерархия ролей и наборы прав',
    icon: Shield,
  },
  {
    id: 'members',
    label: 'Участники',
    description: 'Быстрое назначение ролей и просмотр состава',
    icon: Person,
  },
  {
    id: 'permissions',
    label: 'Права',
    description: 'Каталог permission-ключей по сервисам',
    icon: ListCheck,
  },
  {
    id: 'audit',
    label: 'Аудит',
    description: 'Последние изменения внутри тенанта',
    icon: Pulse,
  },
];

const normalize = (value: string) => value.trim().toLocaleLowerCase();

const formatMemberName = (member: TenantMember | null | undefined) => {
  if (!member) return 'Неизвестный пользователь';
  const name = [member.first_name, member.last_name].filter(Boolean).join(' ').trim();
  return name || member.user_id;
};

const getInitials = (member?: TenantMember | null) => {
  if (!member) return '??';
  const letters = [member.first_name?.[0], member.last_name?.[0]].filter(Boolean).join('');
  return letters || member.user_id.slice(0, 2).toUpperCase();
};

const formatIsoDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');

const hashString = (value: string) =>
  Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0);

const getRoleFallbackColor = (name: string) =>
  ROLE_COLOR_PALETTE[hashString(name) % ROLE_COLOR_PALETTE.length];

const getPermissionResource = (permission: PermissionEntry) =>
  permission.key.split('.')[1] ?? 'misc';

const buildPermissionGroups = (entries: PermissionEntry[]): RolePermissionGroup[] => {
  const serviceMap = new Map<string, Map<string, PermissionEntry[]>>();

  entries.forEach((permission) => {
    const resource = getPermissionResource(permission);
    const resourceMap = serviceMap.get(permission.service) ?? new Map<string, PermissionEntry[]>();
    const items = resourceMap.get(resource) ?? [];
    items.push(permission);
    resourceMap.set(resource, items);
    serviceMap.set(permission.service, resourceMap);
  });

  return Array.from(serviceMap.entries()).map(([service, resourceMap]) => ({
    service,
    resources: Array.from(resourceMap.entries()).map(([resource, items]) => ({
      resource,
      items,
    })),
  }));
};

export const TenantAdminPage: React.FC = () => {
  const { user } = useAuth();
  const isAuthorized = Boolean(user && (user.isSuperuser || can(user, 'portal.roles.read')));
  const canManageRoles = Boolean(user && (user.isSuperuser || can(user, 'portal.roles.write')));
  const canManageBindings = Boolean(
    user && (user.isSuperuser || can(user, 'portal.role_bindings.write')),
  );
  const canViewPermissions = Boolean(
    user && (user.isSuperuser || can(user, ['portal.permissions.read', 'portal.roles.read'])),
  );

  const [activeTab, setActiveTab] = useState<TabKey>('roles');
  const [rolePanelTab, setRolePanelTab] = useState<RolePanelTab>('overview');

  const [memberQuery, setMemberQuery] = useState('');
  const debouncedMemberQuery = useDebouncedValue(memberQuery, 300);

  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const debouncedRoleSearchQuery = useDebouncedValue(roleSearchQuery, 300);

  const [roleQuery, setRoleQuery] = useState('');
  const debouncedRoleQuery = useDebouncedValue(roleQuery, 300);
  const [roleServiceFilter, setRoleServiceFilter] = useState('');
  const [roleScopeFilter, setRoleScopeFilter] = useState<'all' | 'tenant' | 'template'>('all');

  const [permissionQuery, setPermissionQuery] = useState('');
  const debouncedPermissionQuery = useDebouncedValue(permissionQuery, 200);
  const [permissionServiceFilter, setPermissionServiceFilter] = useState('');

  const [rolePermissionQuery, setRolePermissionQuery] = useState('');
  const debouncedRolePermissionQuery = useDebouncedValue(rolePermissionQuery, 200);
  const [rolePermissionServiceFilter, setRolePermissionServiceFilter] = useState('');

  const [auditQuery, setAuditQuery] = useState('');
  const debouncedAuditQuery = useDebouncedValue(auditQuery, 200);

  const tenantId = user?.tenant?.id ?? '';

  const {
    permissions,
    loading: loadingPermissions,
    reload: reloadPermissions,
  } = usePermissionCatalog();

  const {
    roles,
    loading: loadingRoles,
    reload: reloadRoles,
  } = useTenantRoles({
    query: debouncedRoleQuery,
    service: roleServiceFilter || undefined,
    limit: 200,
  });

  const {
    members,
    loading: loadingMembers,
    reload: reloadMembers,
  } = useTenantMembers({
    query: debouncedMemberQuery || undefined,
    limit: 200,
  });

  const { events, loading: loadingEvents, reload: reloadEvents } = useTenantAdminEvents(50);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const [roleFormMode, setRoleFormMode] = useState<RoleFormMode>('create');
  const [selectedRole, setSelectedRole] = useState<TenantRole | null>(null);
  const [roleTemplate, setRoleTemplate] = useState<TenantRole | null>(null);
  const [roleForm, setRoleForm] = useState({
    service: 'portal',
    name: '',
    permissionKeys: [] as string[],
  });
  const [roleColorDraft, setRoleColorDraft] = useState(ROLE_COLOR_PALETTE[0]);
  const [savingRole, setSavingRole] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);

  const [bindingForm, setBindingForm] = useState({
    userId: '',
    scopeType: 'TENANT' as ScopeType,
    scopeId: tenantId,
    roleId: null as number | null,
  });
  const [bindingSaving, setBindingSaving] = useState(false);
  const [bindingDeletingId, setBindingDeletingId] = useState<number | null>(null);

  const [roleColors, setRoleColors] = useState<Record<number, string>>({});

  const selectedBindingUserId =
    selectedMemberId || (bindingForm.userId.trim() ? bindingForm.userId.trim() : null);

  const {
    bindings: memberBindings,
    loading: loadingMemberBindings,
    reload: reloadMemberBindings,
  } = useRoleBindings({
    userId: selectedBindingUserId ?? undefined,
    enabled: Boolean(selectedBindingUserId),
    limit: 200,
  });

  const roleSearchEnabled = Boolean(debouncedRoleSearchQuery.trim());
  const {
    bindings: roleSearchBindings,
    loading: loadingRoleSearch,
    reload: reloadRoleSearch,
  } = useRoleBindings({
    q: roleSearchEnabled ? debouncedRoleSearchQuery : undefined,
    enabled: roleSearchEnabled,
    limit: 200,
  });

  const {
    bindings: roleBindings,
    loading: loadingRoleBindings,
    reload: reloadRoleBindings,
  } = useRoleBindings({
    q: selectedRole?.name ? selectedRole.name : undefined,
    enabled: Boolean(selectedRole?.name),
    limit: 200,
  });

  const refreshAll = useCallback(() => {
    reloadRoles();
    reloadMembers();
    reloadEvents();
    reloadPermissions();

    if (roleSearchEnabled) reloadRoleSearch();
    if (selectedBindingUserId) reloadMemberBindings();
    if (selectedRole?.name) reloadRoleBindings();
  }, [
    reloadEvents,
    reloadMembers,
    reloadPermissions,
    reloadRoles,
    reloadRoleSearch,
    reloadMemberBindings,
    reloadRoleBindings,
    roleSearchEnabled,
    selectedBindingUserId,
    selectedRole?.name,
  ]);

  useEffect(() => {
    if (tenantId) {
      setBindingForm((prev) => ({
        ...prev,
        scopeId: prev.scopeType === 'TENANT' ? tenantId : prev.scopeId,
      }));
    }
  }, [tenantId]);

  useEffect(() => {
    if (selectedMemberId) {
      setBindingForm((prev) => ({
        ...prev,
        userId: selectedMemberId,
      }));
    }
  }, [selectedMemberId]);

  useEffect(() => {
    if (!tenantId) return;
    try {
      const stored = window.localStorage.getItem(`tenant-admin-role-colors:${tenantId}`);
      if (stored) {
        setRoleColors(JSON.parse(stored) as Record<number, string>);
      }
    } catch (error) {
      console.warn('Failed to restore role colors', error);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    try {
      window.localStorage.setItem(
        `tenant-admin-role-colors:${tenantId}`,
        JSON.stringify(roleColors),
      );
    } catch (error) {
      console.warn('Failed to save role colors', error);
    }
  }, [roleColors, tenantId]);

  const membersById = useMemo(() => {
    const map = new Map<string, TenantMember>();
    members.forEach((member) => map.set(member.user_id, member));
    return map;
  }, [members]);

  const selectedMember = selectedMemberId ? membersById.get(selectedMemberId) ?? null : null;

  const normalizedPermissionKeys = useMemo(
    () => (Array.isArray(roleForm.permissionKeys) ? roleForm.permissionKeys : []),
    [roleForm.permissionKeys],
  );

  const serviceOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', content: 'Все сервисы' },
      ...Array.from(new Set(roles.map((item) => item.service))).map((service) => ({
        value: service,
        content: service,
      })),
    ],
    [roles],
  );

  const permissionServiceOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', content: 'Все сервисы' },
      ...Array.from(new Set(permissions.map((item) => item.service))).map((service) => ({
        value: service,
        content: service,
      })),
    ],
    [permissions],
  );

  const bindingRoleOptions = useMemo<SelectOption[]>(
    () =>
      roles.map((item) => ({
        value: String(item.id),
        content: `${item.name} (${item.service})`,
      })),
    [roles],
  );

  const memberOptions = useMemo<SelectOption[]>(
    () =>
      members.map((item) => ({
        value: item.user_id,
        content: `${formatMemberName(item)} · ${item.user_id}`,
      })),
    [members],
  );

  const filteredRoles = useMemo(() => {
    if (roleScopeFilter === 'all') return roles;
    if (roleScopeFilter === 'template') return roles.filter((role) => role.tenant_id === null);
    return roles.filter((role) => role.tenant_id !== null);
  }, [roleScopeFilter, roles]);

  const filteredPermissions = useMemo(() => {
    const query = normalize(debouncedPermissionQuery);
    return permissions.filter((permission) => {
      if (permissionServiceFilter && permission.service !== permissionServiceFilter) return false;
      if (!query) return true;
      const haystack = `${permission.key} ${permission.description}`.toLocaleLowerCase();
      return haystack.includes(query);
    });
  }, [debouncedPermissionQuery, permissionServiceFilter, permissions]);

  const permissionGroups = useMemo(
    () => buildPermissionGroups(filteredPermissions),
    [filteredPermissions],
  );

  const rolePermissionGroups = useMemo(() => {
    const query = normalize(debouncedRolePermissionQuery);
    const filtered = permissions.filter((permission) => {
      if (rolePermissionServiceFilter && permission.service !== rolePermissionServiceFilter) return false;
      if (!query) return true;
      const haystack = `${permission.key} ${permission.description}`.toLocaleLowerCase();
      return haystack.includes(query);
    });
    return buildPermissionGroups(filtered);
  }, [debouncedRolePermissionQuery, permissions, rolePermissionServiceFilter]);

  const filteredEvents = useMemo(() => {
    const query = normalize(debouncedAuditQuery);
    if (!query) return events;
    return events.filter((event) => {
      const metadata = event.metadata ? JSON.stringify(event.metadata).toLocaleLowerCase() : '';
      return (
        event.action.toLocaleLowerCase().includes(query) ||
        event.target_type.toLocaleLowerCase().includes(query) ||
        (event.target_id ?? '').toLocaleLowerCase().includes(query) ||
        event.performed_by.toLocaleLowerCase().includes(query) ||
        metadata.includes(query)
      );
    });
  }, [debouncedAuditQuery, events]);

  const roleSearchGroups = useMemo(() => {
    const groups = new Map<string, typeof roleSearchBindings>();
    roleSearchBindings.forEach((binding) => {
      const key = binding.role_name;
      const existing = groups.get(key) ?? [];
      existing.push(binding);
      groups.set(key, existing);
    });
    return Array.from(groups.entries()).map(([roleName, bindings]) => ({ roleName, bindings }));
  }, [roleSearchBindings]);

  const memberRows = useMemo<MemberRow[]>(
    () =>
      members.map((member) => ({
        id: member.user_id,
        displayName: formatMemberName(member),
        userId: member.user_id,
        createdAt: formatIsoDate(member.created_at),
        updatedAt: formatIsoDate(member.updated_at),
        initials: getInitials(member),
      })),
    [members],
  );

  const memberColumns = useMemo<TableColumnConfig<MemberRow>[]>(
    () => [
      {
        id: 'displayName',
        name: 'Участник',
        template: (row) => (
          <div className="tenant-admin__member-cell">
            <Avatar size="m" text={row.initials} />
            <div>
              <div className="tenant-admin__member-name">{row.displayName}</div>
              <div className="tenant-admin__member-meta">{row.userId}</div>
            </div>
          </div>
        ),
      },
      {
        id: 'createdAt',
        name: 'В тенанте с',
        width: 190,
        template: (row) => <span className="tenant-admin__member-meta">{row.createdAt}</span>,
      },
      {
        id: 'updatedAt',
        name: 'Обновлено',
        width: 190,
        template: (row) => <span className="tenant-admin__member-meta">{row.updatedAt}</span>,
      },
      {
        id: 'actions',
        name: 'Действия',
        width: 140,
        template: (row) => {
          const isSelected = row.userId === selectedMemberId;
          return (
            <Button
              size="s"
              view={isSelected ? 'action' : 'flat'}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedMemberId(row.userId);
              }}
            >
              {isSelected ? 'Выбран' : 'Открыть'}
            </Button>
          );
        },
      },
    ],
    [selectedMemberId],
  );

  const getRoleColor = useCallback(
    (role: TenantRole) => roleColors[role.id] ?? getRoleFallbackColor(role.name),
    [roleColors],
  );

  const setRoleColor = useCallback((roleId: number, color: string) => {
    setRoleColors((prev) => ({ ...prev, [roleId]: color }));
  }, []);

  const handleRoleSelect = useCallback(
    (role: TenantRole) => {
      setSelectedRole(role);
      setRoleTemplate(role.tenant_id === null ? role : null);
      const isTemplate = role.tenant_id === null;
      setRoleFormMode(isTemplate ? 'clone' : 'edit');
      setRoleForm({
        service: role.service,
        name: role.name,
        permissionKeys: role.permission_keys ?? [],
      });
      setRoleColorDraft(getRoleColor(role));
      setRolePanelTab('overview');
    },
    [getRoleColor],
  );

  const resetRoleForm = useCallback(() => {
    setSelectedRole(null);
    setRoleTemplate(null);
    setRoleFormMode('create');
    setRoleForm({ service: 'portal', name: '', permissionKeys: [] });
    setRoleColorDraft(ROLE_COLOR_PALETTE[0]);
    setRolePanelTab('overview');
  }, []);

  const handleRoleSubmit = async () => {
    if (!canManageRoles || !roleForm.service.trim() || !roleForm.name.trim()) return;

    setSavingRole(true);
    try {
      const payload = {
        service: roleForm.service.trim(),
        name: roleForm.name.trim(),
        permission_keys: normalizedPermissionKeys,
      };

      let savedRole: TenantRole;

      if (selectedRole && roleFormMode === 'edit') {
        savedRole = await updateTenantRole(selectedRole.id, payload);
        toaster.add({
          name: `role-${Date.now()}`,
          title: 'Роль обновлена',
          content: 'Изменения сохранены',
          theme: 'success',
        });
      } else {
        savedRole = await createTenantRole(payload);
        toaster.add({
          name: `role-${Date.now()}`,
          title: 'Роль создана',
          content: roleTemplate ? 'Копия роли добавлена в каталог' : 'Роль добавлена в каталог',
          theme: 'success',
        });
      }

      if (savedRole?.id) {
        setRoleColor(savedRole.id, roleColorDraft);
      }

      resetRoleForm();
      reloadRoles();
      reloadEvents();
    } catch (error) {
      notifyApiError(error, 'Не удалось сохранить роль');
    } finally {
      setSavingRole(false);
    }
  };

  const handleRoleDelete = async (role: TenantRole) => {
    if (!canManageRoles || role.tenant_id === null) return;

    if (!window.confirm(`Удалить роль «${role.name}»?`)) return;

    setDeletingRoleId(role.id);
    try {
      await deleteTenantRole(role.id);
      toaster.add({ name: `role-${Date.now()}`, title: 'Роль удалена', theme: 'success' });
      setRoleColors((prev) => {
        const next = { ...prev };
        delete next[role.id];
        return next;
      });
      resetRoleForm();
      reloadRoles();
      reloadEvents();
    } catch (error) {
      notifyApiError(error, 'Не удалось удалить роль');
    } finally {
      setDeletingRoleId(null);
    }
  };

  const handleBindingSubmit = async () => {
    if (
      !canManageBindings ||
      !bindingForm.userId.trim() ||
      !bindingForm.scopeId.trim() ||
      !bindingForm.roleId
    ) {
      return;
    }

    setBindingSaving(true);
    try {
      await createRoleBinding({
        tenant_id: tenantId,
        user_id: bindingForm.userId.trim(),
        scope_type: bindingForm.scopeType,
        scope_id: bindingForm.scopeId.trim(),
        role_id: bindingForm.roleId,
      });

      toaster.add({ name: `binding-${Date.now()}`, title: 'Назначение создано', theme: 'success' });

      setBindingForm((prev) => ({ ...prev, roleId: null }));

      reloadMemberBindings();
      reloadRoleSearch();
      reloadRoleBindings();
      reloadEvents();
    } catch (error) {
      notifyApiError(error, 'Не удалось назначить роль');
    } finally {
      setBindingSaving(false);
    }
  };

  const handleBindingDelete = async (bindingId: number) => {
    if (!canManageBindings) return;

    if (!window.confirm('Удалить назначение?')) return;

    setBindingDeletingId(bindingId);
    try {
      await deleteRoleBinding(bindingId);
      toaster.add({ name: `binding-${Date.now()}`, title: 'Назначение удалено', theme: 'success' });
      reloadMemberBindings();
      reloadRoleSearch();
      reloadRoleBindings();
      reloadEvents();
    } catch (error) {
      notifyApiError(error, 'Не удалось удалить назначение');
    } finally {
      setBindingDeletingId(null);
    }
  };

  const isTemplateSelected = selectedRole?.tenant_id === null;

  const roleBindingsForSelected = useMemo<TenantBinding[]>(
    () =>
      selectedRole
        ? roleBindings.filter((binding) => binding.role_id === selectedRole.id)
        : [],
    [roleBindings, selectedRole],
  );

  const handlePermissionToggle = useCallback((key: string, checked: boolean) => {
    setRoleForm((prev) => {
      const next = new Set(prev.permissionKeys ?? []);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return { ...prev, permissionKeys: Array.from(next) };
    });
  }, []);

  if (!user) return <StatusView kind="loading" />;

  if (!isAuthorized) {
    return (
      <StatusView
        kind="no-access"
        description="Только администраторы тенанта могут управлять доступом"
      />
    );
  }

  return (
    <div className="tenant-admin">
      <div className="tenant-admin__hero">
        <div>
          <div className="tenant-admin__kicker">Tenant Admin</div>
          <h1 className="tenant-admin__title">Роли, доступы и аудит</h1>
          <p className="tenant-admin__subtitle">
            Управляйте составом и правами без лишних форм — быстрая выдача ролей, аудит,
            группировка permission-ключей.
          </p>
        </div>
        <div className="tenant-admin__hero-actions">
          {!canManageRoles && !canManageBindings ? (
            <Label theme="warning" size="s">
              Только чтение
            </Label>
          ) : null}
          <Button view="outlined" size="m" onClick={refreshAll}>
            Обновить
          </Button>
        </div>
      </div>

      <div className="tenant-admin__layout">
        <aside className="tenant-admin__sidebar">
          <div className="tenant-admin__nav">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`tenant-admin__nav-item ${
                  activeTab === tab.id ? 'is-active' : ''
                }`}
              >
                <span className="tenant-admin__nav-icon">
                  <Icon data={tab.icon} size={18} />
                </span>
                <span>
                  <span className="tenant-admin__nav-title">{tab.label}</span>
                  <span className="tenant-admin__nav-subtitle">{tab.description}</span>
                </span>
              </button>
            ))}
          </div>

          <Card className="tenant-admin__sidebar-card">
            <div className="tenant-admin__sidebar-title">Статус</div>
            <div className="tenant-admin__sidebar-metric">
              <span>Участники</span>
              <strong>{members.length}</strong>
            </div>
            <div className="tenant-admin__sidebar-metric">
              <span>Роли</span>
              <strong>{roles.length}</strong>
            </div>
            <div className="tenant-admin__sidebar-metric">
              <span>Последнее событие</span>
              <strong>{events[0]?.action ?? 'Нет данных'}</strong>
            </div>
            <div className="tenant-admin__sidebar-meta">
              {formatIsoDate(events[0]?.created_at)}
            </div>
          </Card>
        </aside>

        <section className="tenant-admin__content">
          {activeTab === 'members' && (
            <div className="tenant-admin__panel">
              <div className="tenant-admin__panel-header">
                <div>
                  <h2>Участники</h2>
                  <p>Ищите людей, смотрите активные роли и выдавайте доступы.</p>
                </div>
              </div>

              <div className="tenant-admin__panel-grid">
                <Card className="tenant-admin__card">
                  <div className="tenant-admin__card-head">
                    <div>
                      <div className="tenant-admin__card-title">Состав тенанта</div>
                      <div className="tenant-admin__card-subtitle">
                        Подберите участника и переходите к назначению ролей справа.
                      </div>
                    </div>
                    <div className="tenant-admin__search">
                      <TextInput
                        value={memberQuery}
                        placeholder="Поиск по имени или ID"
                        onUpdate={(value) => setMemberQuery(value)}
                        startContent={<Icon data={Magnifier} size={16} />}
                      />
                    </div>
                  </div>

                  {loadingMembers ? (
                    <div className="tenant-admin__loader">
                      <Loader size="m" />
                      <span>Загружаем участников...</span>
                    </div>
                  ) : members.length === 0 ? (
                    <div className="tenant-admin__empty">Никого не нашли. Попробуйте изменить запрос.</div>
                  ) : (
                    <Table
                      columns={memberColumns}
                      data={memberRows}
                      wordWrap
                      width="max"
                      getRowDescriptor={(row) => ({
                        id: row.id,
                        classNames: [
                          'tenant-admin__table-row',
                          row.userId === selectedMemberId ? 'is-active' : '',
                        ],
                      })}
                    />
                  )}
                </Card>

                <Card className="tenant-admin__card tenant-admin__card--sticky">
                  <div className="tenant-admin__card-head">
                    <div>
                      <div className="tenant-admin__card-title">Профиль участника</div>
                      <div className="tenant-admin__card-subtitle">
                        Управляйте ролями и областями для выбранного пользователя.
                      </div>
                    </div>
                    {selectedMemberId && (
                      <Button view="flat" size="s" onClick={() => setSelectedMemberId(null)}>
                        Сбросить
                      </Button>
                    )}
                  </div>

                  <div className="tenant-admin__member-card">
                    <Avatar size="l" text={getInitials(selectedMember)} />
                    <div>
                      <div className="tenant-admin__member-name">
                        {selectedMember
                          ? formatMemberName(selectedMember)
                          : selectedMemberId ?? 'Не выбран'}
                      </div>
                      <div className="tenant-admin__member-meta">
                        {selectedMember
                          ? selectedMember.user_id
                          : selectedMemberId ?? 'Выберите пользователя из списка'}
                      </div>
                    </div>
                  </div>

                  <div className="tenant-admin__section">
                    <div className="tenant-admin__section-head">
                      <span>Текущие роли</span>
                      {!canManageBindings && (
                        <Label theme="warning" size="s">
                          Нет прав на изменение
                        </Label>
                      )}
                    </div>

                    {!selectedBindingUserId ? (
                      <div className="tenant-admin__empty">Сначала выберите пользователя.</div>
                    ) : loadingMemberBindings ? (
                      <div className="tenant-admin__loader">
                        <Loader size="s" />
                        <span>Загружаем назначения...</span>
                      </div>
                    ) : memberBindings.length === 0 ? (
                      <div className="tenant-admin__empty">Назначений пока нет.</div>
                    ) : (
                      <div className="tenant-admin__binding-list">
                        {memberBindings.map((binding) => (
                          <div key={binding.id} className="tenant-admin__binding-item">
                            <div>
                              <div className="tenant-admin__binding-title">{binding.role_name}</div>
                              <div className="tenant-admin__binding-meta">
                                {binding.role_service} · {binding.scope_type}/{binding.scope_id}
                              </div>
                            </div>
                            {canManageBindings && (
                              <Button
                                view="flat"
                                size="s"
                                disabled={bindingDeletingId === binding.id}
                                onClick={() => handleBindingDelete(binding.id)}
                              >
                                {bindingDeletingId === binding.id ? 'Удаление…' : 'Удалить'}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="tenant-admin__section">
                    <div className="tenant-admin__section-head">Назначить роль</div>

                    <Select
                      options={memberOptions}
                      value={bindingForm.userId ? [bindingForm.userId] : []}
                      onUpdate={(value) =>
                        setBindingForm((prev) => ({ ...prev, userId: value[0] ?? '' }))
                      }
                      placeholder="Выберите участника"
                      width="max"
                      filterable
                      disabled={!canManageBindings}
                    />

                    <Select
                      options={bindingRoleOptions}
                      value={bindingForm.roleId ? [String(bindingForm.roleId)] : []}
                      onUpdate={(value) =>
                        setBindingForm((prev) => ({
                          ...prev,
                          roleId: value[0] ? Number(value[0]) : null,
                        }))
                      }
                      placeholder="Роль"
                      width="max"
                      disabled={!canManageBindings}
                    />

                    <div className="tenant-admin__scope-grid">
                      <Select
                        options={SCOPE_TYPES.map((type) => ({ value: type, content: SCOPE_LABELS[type] }))}
                        value={[bindingForm.scopeType]}
                        onUpdate={(value) =>
                          setBindingForm((prev) => ({
                            ...prev,
                            scopeType: (value[0] ?? prev.scopeType) as ScopeType,
                            scopeId: value[0] === 'TENANT' ? tenantId : prev.scopeId,
                          }))
                        }
                        disabled={!canManageBindings}
                      />
                      <TextInput
                        placeholder="Scope ID"
                        value={bindingForm.scopeId}
                        onUpdate={(value) => setBindingForm((prev) => ({ ...prev, scopeId: value }))}
                        disabled={!canManageBindings}
                      />
                    </div>

                    <Button
                      view="action"
                      loading={bindingSaving}
                      onClick={handleBindingSubmit}
                      disabled={!canManageBindings}
                    >
                      Назначить роль
                    </Button>
                  </div>

                  <div className="tenant-admin__section">
                    <div className="tenant-admin__section-head">Поиск по роли</div>
                    <TextInput
                      value={roleSearchQuery}
                      placeholder="Например: Модератор"
                      onUpdate={(value) => setRoleSearchQuery(value)}
                      startContent={<Icon data={Magnifier} size={16} />}
                    />

                    {!roleSearchEnabled ? (
                      <div className="tenant-admin__empty">
                        Введите название роли, чтобы увидеть всех участников с ней.
                      </div>
                    ) : loadingRoleSearch ? (
                      <div className="tenant-admin__loader">
                        <Loader size="s" />
                        <span>Ищем совпадения...</span>
                      </div>
                    ) : roleSearchBindings.length === 0 ? (
                      <div className="tenant-admin__empty">Совпадений по ролям не найдено.</div>
                    ) : (
                      <div className="tenant-admin__role-search-results">
                        {roleSearchGroups.map((group) => (
                          <div key={group.roleName} className="tenant-admin__role-search-group">
                            <div className="tenant-admin__role-search-head">
                              <span>{group.roleName}</span>
                              <Label theme="info" size="s">
                                {group.bindings.length}
                              </Label>
                            </div>
                            <div className="tenant-admin__role-search-body">
                              {group.bindings.map((binding) => {
                                const member = membersById.get(binding.user_id);
                                const label = member ? formatMemberName(member) : binding.user_id;
                                return (
                                  <Button
                                    key={`${binding.id}-${binding.user_id}`}
                                    view="outlined"
                                    size="s"
                                    onClick={() => setSelectedMemberId(binding.user_id)}
                                  >
                                    {label}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="tenant-admin__panel">
              <div className="tenant-admin__panel-header">
                <div>
                  <h2>Роли и доступы</h2>
                  <p>Переосмысливаем права как в Discord: список ролей слева, детали справа.</p>
                </div>
                <Button
                  view="action"
                  size="m"
                  onClick={resetRoleForm}
                  disabled={!canManageRoles}
                >
                  <Icon data={Plus} size={14} /> Новая роль
                </Button>
              </div>

              <div className="tenant-admin__panel-grid">
                <Card className="tenant-admin__card">
                  <div className="tenant-admin__card-head">
                    <div>
                      <div className="tenant-admin__card-title">Каталог ролей</div>
                      <div className="tenant-admin__card-subtitle">
                        Быстро выбирайте роль для просмотра прав и участников.
                      </div>
                    </div>
                  </div>

                  <div className="tenant-admin__role-filters">
                    <TextInput
                      value={roleQuery}
                      placeholder="Поиск по названию роли"
                      onUpdate={(value) => setRoleQuery(value)}
                      startContent={<Icon data={Magnifier} size={16} />}
                    />
                    <Select
                      options={serviceOptions}
                      value={roleServiceFilter ? [roleServiceFilter] : []}
                      onUpdate={(value) => setRoleServiceFilter(value[0] ?? '')}
                      placeholder="Сервис"
                    />
                    <Select
                      options={ROLE_SCOPE_OPTIONS}
                      value={[roleScopeFilter]}
                      onUpdate={(value) => setRoleScopeFilter((value[0] ?? 'all') as typeof roleScopeFilter)}
                    />
                  </div>

                  {loadingRoles ? (
                    <div className="tenant-admin__loader">
                      <Loader size="m" />
                      <span>Загружаем роли...</span>
                    </div>
                  ) : filteredRoles.length === 0 ? (
                    <div className="tenant-admin__empty">Ролей не найдено.</div>
                  ) : (
                    <div className="tenant-admin__role-list">
                      {filteredRoles.map((role) => {
                        const isTemplate = role.tenant_id === null;
                        const isSelected = selectedRole?.id === role.id;
                        const permissionCount = role.permission_keys?.length ?? 0;
                        return (
                          <button
                            key={role.id}
                            type="button"
                            className={`tenant-admin__role-item ${isSelected ? 'is-active' : ''}`}
                            onClick={() => handleRoleSelect(role)}
                          >
                            <span
                              className="tenant-admin__role-dot"
                              style={{ background: getRoleColor(role) }}
                            />
                            <span className="tenant-admin__role-body">
                              <span className="tenant-admin__role-title">{role.name}</span>
                              <span className="tenant-admin__role-meta">{role.service}</span>
                            </span>
                            <span className="tenant-admin__role-tags">
                              {isTemplate ? (
                                <Label theme="normal" size="s">
                                  Шаблон
                                </Label>
                              ) : null}
                              <Label theme="info" size="s">
                                {permissionCount} прав
                              </Label>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <Card className="tenant-admin__card tenant-admin__card--sticky">
                  <div className="tenant-admin__card-head">
                    <div>
                      <div className="tenant-admin__card-title">
                        {selectedRole ? 'Настройка роли' : 'Создание роли'}
                      </div>
                      <div className="tenant-admin__card-subtitle">
                        {selectedRole
                          ? `Выбрана роль: ${selectedRole.name}`
                          : 'Создайте новую роль для тенанта.'}
                      </div>
                    </div>
                    {selectedRole && (
                      <Button view="flat" size="s" onClick={resetRoleForm}>
                        Сбросить
                      </Button>
                    )}
                  </div>

                  <div className="tenant-admin__role-tabs">
                    {(['overview', 'permissions', 'members'] as RolePanelTab[]).map((tab) => (
                      <Button
                        key={tab}
                        view={rolePanelTab === tab ? 'action' : 'outlined'}
                        size="s"
                        onClick={() => setRolePanelTab(tab)}
                      >
                        {tab === 'overview'
                          ? 'Общее'
                          : tab === 'permissions'
                            ? 'Права'
                            : 'Участники'}
                      </Button>
                    ))}
                  </div>

                  {rolePanelTab === 'overview' && (
                    <div className="tenant-admin__role-overview">
                      <div className="tenant-admin__role-highlight">
                        <span
                          className="tenant-admin__role-dot"
                          style={{ background: roleColorDraft }}
                        />
                        <div>
                          <div className="tenant-admin__role-title">{roleForm.name || 'Новая роль'}</div>
                          <div className="tenant-admin__role-meta">{roleForm.service}</div>
                        </div>
                      </div>

                      {isTemplateSelected && (
                        <Label theme="normal" size="s">
                          Шаблон системы — редактируется как копия
                        </Label>
                      )}

                      <div className="tenant-admin__field">
                        <label className="tenant-admin__field-label">Название роли</label>
                        <TextInput
                          value={roleForm.name}
                          onUpdate={(value) => setRoleForm((prev) => ({ ...prev, name: value }))}
                          disabled={!canManageRoles}
                        />
                      </div>

                      <div className="tenant-admin__field">
                        <label className="tenant-admin__field-label">Сервис</label>
                        <TextInput
                          value={roleForm.service}
                          onUpdate={(value) => setRoleForm((prev) => ({ ...prev, service: value }))}
                          disabled={!canManageRoles}
                        />
                      </div>

                      <div className="tenant-admin__field">
                        <label className="tenant-admin__field-label">Цвет роли</label>
                        <div className="tenant-admin__color-field">
                          <input
                            className="tenant-admin__color-input"
                            type="color"
                            value={roleColorDraft}
                            onChange={(event) => setRoleColorDraft(event.target.value)}
                            disabled={!canManageRoles}
                          />
                          <span className="tenant-admin__field-hint">
                            Цвет хранится локально, чтобы сразу видеть роли в списке.
                          </span>
                        </div>
                      </div>

                      <div className="tenant-admin__field">
                        <label className="tenant-admin__field-label">Права (выбрано)</label>
                        <div className="tenant-admin__permission-preview">
                          {normalizedPermissionKeys.length === 0 ? (
                            <div className="tenant-admin__empty">Пока нет прав.</div>
                          ) : (
                            normalizedPermissionKeys.map((permission) => (
                              <Label key={permission} theme="info" size="s">
                                {permission}
                              </Label>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {rolePanelTab === 'permissions' && (
                    <div className="tenant-admin__role-permissions">
                      <div className="tenant-admin__permission-toolbar">
                        <TextInput
                          value={rolePermissionQuery}
                          placeholder="Поиск по ключу или описанию"
                          onUpdate={(value) => setRolePermissionQuery(value)}
                          startContent={<Icon data={Magnifier} size={16} />}
                        />
                        <Select
                          options={permissionServiceOptions}
                          value={rolePermissionServiceFilter ? [rolePermissionServiceFilter] : []}
                          onUpdate={(value) => setRolePermissionServiceFilter(value[0] ?? '')}
                          placeholder="Сервис"
                        />
                        <Button
                          view="flat"
                          size="s"
                          disabled={!canManageRoles}
                          onClick={() =>
                            setRoleForm((prev) => ({ ...prev, permissionKeys: [] }))
                          }
                        >
                          Очистить
                        </Button>
                      </div>

                      {loadingPermissions ? (
                        <div className="tenant-admin__loader">
                          <Loader size="s" />
                          <span>Загружаем права...</span>
                        </div>
                      ) : rolePermissionGroups.length === 0 ? (
                        <div className="tenant-admin__empty">Совпадений не найдено.</div>
                      ) : (
                        <div className="tenant-admin__permission-groups">
                          {rolePermissionGroups.map((group) => (
                            <div key={group.service} className="tenant-admin__permission-service">
                              <div className="tenant-admin__permission-service-head">
                                <span>{group.service}</span>
                                <Label theme="normal" size="s">
                                  {group.resources.reduce(
                                    (acc, resource) => acc + resource.items.length,
                                    0,
                                  )}
                                </Label>
                              </div>
                              {group.resources.map((resource) => (
                                <div key={resource.resource} className="tenant-admin__permission-group">
                                  <div className="tenant-admin__permission-group-title">
                                    {resource.resource}
                                  </div>
                                  <div className="tenant-admin__permission-list">
                                    {resource.items.map((permission) => {
                                      const isSelected = normalizedPermissionKeys.includes(
                                        permission.key,
                                      );
                                      return (
                                        <div
                                          key={permission.key}
                                          className="tenant-admin__permission-row"
                                        >
                                          <div>
                                            <div className="tenant-admin__permission-key">
                                              {permission.key}
                                            </div>
                                            <div className="tenant-admin__permission-desc">
                                              {permission.description}
                                            </div>
                                          </div>
                                          <Switch
                                            size="m"
                                            checked={isSelected}
                                            disabled={!canManageRoles}
                                            onUpdate={(checked) =>
                                              handlePermissionToggle(permission.key, checked)
                                            }
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {rolePanelTab === 'members' && (
                    <div className="tenant-admin__role-members">
                      {selectedRole ? (
                        loadingRoleBindings ? (
                          <div className="tenant-admin__loader">
                            <Loader size="s" />
                            <span>Загружаем участников роли...</span>
                          </div>
                        ) : roleBindingsForSelected.length === 0 ? (
                          <div className="tenant-admin__empty">Эта роль никому не назначена.</div>
                        ) : (
                          <div className="tenant-admin__role-members-list">
                            {roleBindingsForSelected.map((binding) => {
                              const member = membersById.get(binding.user_id);
                              return (
                                <div key={binding.id} className="tenant-admin__role-member">
                                  <Avatar size="s" text={getInitials(member)} />
                                  <div>
                                    <div className="tenant-admin__member-name">
                                      {member ? formatMemberName(member) : binding.user_id}
                                    </div>
                                    <div className="tenant-admin__member-meta">
                                      {binding.scope_type}/{binding.scope_id}
                                    </div>
                                  </div>
                                  <Button
                                    view="flat"
                                    size="s"
                                    onClick={() => setSelectedMemberId(binding.user_id)}
                                  >
                                    Открыть
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )
                      ) : (
                        <div className="tenant-admin__empty">Выберите роль слева, чтобы увидеть участников.</div>
                      )}
                    </div>
                  )}

                  <div className="tenant-admin__role-actions">
                    <Button
                      view="action"
                      loading={savingRole}
                      onClick={handleRoleSubmit}
                      disabled={!canManageRoles}
                    >
                      {roleFormMode === 'edit' ? 'Сохранить изменения' : 'Создать роль'}
                    </Button>
                    {selectedRole && !isTemplateSelected && (
                      <Button
                        view="outlined"
                        disabled={Boolean(deletingRoleId) || !canManageRoles}
                        onClick={() => handleRoleDelete(selectedRole)}
                      >
                        {deletingRoleId === selectedRole.id ? 'Удаление…' : 'Удалить роль'}
                      </Button>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="tenant-admin__panel">
              <div className="tenant-admin__panel-header">
                <div>
                  <h2>Каталог прав</h2>
                  <p>Структурированный список permission-ключей по сервисам и модулям.</p>
                </div>
              </div>

              <Card className="tenant-admin__card">
                {!canViewPermissions ? (
                  <div className="tenant-admin__empty">Нет доступа к каталогу прав.</div>
                ) : (
                  <>
                    <div className="tenant-admin__permission-toolbar">
                      <TextInput
                        value={permissionQuery}
                        placeholder="Поиск по ключу или описанию"
                        onUpdate={(value) => setPermissionQuery(value)}
                        startContent={<Icon data={Magnifier} size={16} />}
                      />
                      <Select
                        options={permissionServiceOptions}
                        value={permissionServiceFilter ? [permissionServiceFilter] : []}
                        onUpdate={(value) => setPermissionServiceFilter(value[0] ?? '')}
                        placeholder="Сервис"
                      />
                    </div>

                    {loadingPermissions ? (
                      <div className="tenant-admin__loader">
                        <Loader size="m" />
                        <span>Загружаем права...</span>
                      </div>
                    ) : permissionGroups.length === 0 ? (
                      <div className="tenant-admin__empty">Ничего не найдено.</div>
                    ) : (
                      <div className="tenant-admin__permission-groups">
                        {permissionGroups.map((group) => (
                          <div key={group.service} className="tenant-admin__permission-service">
                            <div className="tenant-admin__permission-service-head">
                              <span>{group.service}</span>
                              <Label theme="normal" size="s">
                                {group.resources.reduce(
                                  (acc, resource) => acc + resource.items.length,
                                  0,
                                )}
                              </Label>
                            </div>
                            {group.resources.map((resource) => (
                              <div key={resource.resource} className="tenant-admin__permission-group">
                                <div className="tenant-admin__permission-group-title">
                                  {resource.resource}
                                </div>
                                <div className="tenant-admin__permission-list">
                                  {resource.items.map((permission) => (
                                    <div key={permission.key} className="tenant-admin__permission-row">
                                      <div>
                                        <div className="tenant-admin__permission-key">
                                          {permission.key}
                                        </div>
                                        <div className="tenant-admin__permission-desc">
                                          {permission.description}
                                        </div>
                                      </div>
                                      <Label theme="info" size="s">
                                        {permission.service}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="tenant-admin__panel">
              <div className="tenant-admin__panel-header">
                <div>
                  <h2>Аудит действий</h2>
                  <p>Кто и когда менял роли, права и назначения в тенанте.</p>
                </div>
                <Button view="outlined" size="m" onClick={reloadEvents}>
                  Обновить
                </Button>
              </div>

              <Card className="tenant-admin__card">
                <TextInput
                  value={auditQuery}
                  placeholder="Поиск по действию, пользователю или роли"
                  onUpdate={(value) => setAuditQuery(value)}
                  startContent={<Icon data={Magnifier} size={16} />}
                />

                {loadingEvents ? (
                  <div className="tenant-admin__loader">
                    <Loader size="m" />
                    <span>Загружаем события...</span>
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="tenant-admin__empty">Событий пока нет.</div>
                ) : (
                  <div className="tenant-admin__audit-list">
                    {filteredEvents.map((event) => (
                      <div key={event.id} className="tenant-admin__audit-item">
                        <div className="tenant-admin__audit-head">
                          <span className="tenant-admin__audit-action">{event.action}</span>
                          <span className="tenant-admin__audit-time">{formatIsoDate(event.created_at)}</span>
                        </div>
                        <div className="tenant-admin__audit-body">
                          <div className="tenant-admin__audit-target">
                            {event.target_type}
                            {event.target_id ? ` · ${event.target_id}` : ''}
                          </div>
                          <div className="tenant-admin__audit-meta">
                            Исполнитель: {event.performed_by}
                          </div>
                          {event.metadata && Object.keys(event.metadata).length > 0 ? (
                            <pre className="tenant-admin__audit-meta tenant-admin__audit-meta--code">
                              {JSON.stringify(event.metadata, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
