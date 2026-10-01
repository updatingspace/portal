import { ScopePicker } from '../../modules/tenantAdmin/components/ScopePicker';
import { MemberAvatar } from '../../modules/tenantAdmin/components/MemberAvatar';
import { AdminApplicationsPage } from '../../modules/portal/pages/AdminApplicationsPage';
import { InlineError, useUITranslation } from '../../shared/ui/portal/PortalUI';
import { SectionTabs } from '../../shared/ui/portal/SectionTabs';
import { ContentDialog } from '../../shared/ui/portal/ContentDialog';
import { useUrlState } from '../../shared/hooks/useUrlState';
import { useConfirmation } from '../../shared/ui/portal/useConfirmation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Icon,
  Label,
  Loader,
  Select,
  Switch,
  TextInput,
  type SelectOption,
} from '@gravity-ui/uikit';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Plus from '@gravity-ui/icons/Plus';
import Person from '@gravity-ui/icons/Person';
import Shield from '@gravity-ui/icons/Shield';
import ListCheck from '@gravity-ui/icons/ListCheck';
import Pulse from '@gravity-ui/icons/Pulse';

import './tenant-admin.css';
import {
  permissionLabel,
  presentAuditEvent,
  resourceLabel,
  roleLabel,
  scopeLabel,
  serviceLabel,
} from '../../modules/tenantAdmin/presentation';

import { useAuth } from '../../contexts/AuthContext';
import { StatusView } from '../../modules/portal/components/StatusView';
import { can } from '../../features/rbac/can';
import { toaster } from '../../toaster';
import { getLocale } from '../../shared/lib/locale';
import { formatDateTime } from '../../shared/lib/formatters';
import { notifyApiError } from '../../utils/apiErrorHandling';
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue';
import {
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

function AdminDetailPanel({
  title,
  open,
  busy,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <ContentDialog title={title} busy={busy} onClose={onClose}>
      <div className="tenant-admin tenant-admin--dialog">{children}</div>
    </ContentDialog>
  );
}

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

const ROLE_SCOPE_OPTIONS: Array<{
  value: 'all' | 'tenant' | 'template';
  content: string;
}> = [
  { value: 'all', content: 'Все роли' },
  { value: 'tenant', content: 'Роли сообщества' },
  { value: 'template', content: 'Шаблоны системы' },
];

type TabKey = 'members' | 'roles' | 'permissions' | 'audit' | 'applications';

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
    id: 'members',
    label: 'Участники',
    description: 'Быстрое назначение ролей и просмотр состава',
    icon: Person,
  },
  {
    id: 'roles',
    label: 'Роли',
    description: 'Иерархия ролей и наборы прав',
    icon: Shield,
  },
  {
    id: 'permissions',
    label: 'Права',
    description: 'Какие действия доступны участникам',
    icon: ListCheck,
  },
  {
    id: 'audit',
    label: 'Аудит',
    description: 'Кто и когда изменил доступ',
    icon: Pulse,
  },
];

const normalize = (value: string) => value.trim().toLocaleLowerCase();

const formatMemberName = (member: TenantMember | null | undefined) => {
  if (!member)
    return getLocale() === 'ru' ? 'Неизвестный пользователь' : 'Unknown member';
  const name = [member.first_name, member.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return (
    name || (getLocale() === 'ru' ? 'Участник без имени' : 'Unnamed member')
  );
};

const getInitials = (member?: TenantMember | null) => {
  if (!member) return '??';
  const letters = [member.first_name?.[0], member.last_name?.[0]]
    .filter(Boolean)
    .join('');
  return letters || member.user_id.slice(0, 2).toUpperCase();
};

const formatIsoDate = (value?: string | null) =>
  value ? formatDateTime(value) : '—';

const hashString = (value: string) =>
  Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0);

const getRoleFallbackColor = (name: string) =>
  ROLE_COLOR_PALETTE[hashString(name) % ROLE_COLOR_PALETTE.length];

const getPermissionResource = (permission: PermissionEntry) =>
  permission.key.split('.')[1] ?? 'misc';

const buildPermissionGroups = (
  entries: PermissionEntry[],
): RolePermissionGroup[] => {
  const serviceMap = new Map<string, Map<string, PermissionEntry[]>>();

  entries.forEach((permission) => {
    const resource = getPermissionResource(permission);
    const resourceMap =
      serviceMap.get(permission.service) ??
      new Map<string, PermissionEntry[]>();
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
  const t = useUITranslation();
  const { confirm, confirmationDialog } = useConfirmation();
  const { user } = useAuth();
  const isAuthorized = Boolean(
    user && (user.isSuperuser || can(user, 'portal.roles.read')),
  );
  const canManageRoles = Boolean(
    user && (user.isSuperuser || can(user, 'portal.roles.write')),
  );
  const canManageBindings = Boolean(
    user && (user.isSuperuser || can(user, 'portal.role_bindings.write')),
  );
  const canViewPermissions = Boolean(
    user &&
      (user.isSuperuser ||
        can(user, ['portal.permissions.read', 'portal.roles.read'])),
  );

  const [activeTab, setActiveTab] = useUrlState<TabKey>('tab', 'members', [
    'members',
    'roles',
    'permissions',
    'audit',
    'applications',
  ]);
  const [rolePanelTab, setRolePanelTab] = useState<RolePanelTab>('overview');

  const [memberQuery, setMemberQuery] = useState('');
  const debouncedMemberQuery = useDebouncedValue(memberQuery, 300);

  const [roleQuery, setRoleQuery] = useState('');
  const debouncedRoleQuery = useDebouncedValue(roleQuery, 300);
  const [roleServiceFilter, setRoleServiceFilter] = useState('');
  const [roleScopeFilter, setRoleScopeFilter] = useState<
    'all' | 'tenant' | 'template'
  >('all');

  const [permissionQuery, setPermissionQuery] = useState('');
  const debouncedPermissionQuery = useDebouncedValue(permissionQuery, 200);
  const [permissionServiceFilter, setPermissionServiceFilter] = useState('');

  const [rolePermissionQuery, setRolePermissionQuery] = useState('');
  const debouncedRolePermissionQuery = useDebouncedValue(
    rolePermissionQuery,
    200,
  );
  const [rolePermissionServiceFilter, setRolePermissionServiceFilter] =
    useState('');

  const [auditQuery, setAuditQuery] = useState('');
  const debouncedAuditQuery = useDebouncedValue(auditQuery, 200);

  const tenantId = user?.tenant?.id ?? '';

  const {
    permissions,
    loading: loadingPermissions,
    error: errorPermissions,
    reload: reloadPermissions,
  } = usePermissionCatalog();

  const {
    roles,
    loading: loadingRoles,
    error: errorRoles,
    reload: reloadRoles,
  } = useTenantRoles({
    limit: 200,
  });

  const {
    members,
    loading: loadingMembers,
    error: errorMembers,
    reload: reloadMembers,
  } = useTenantMembers({
    limit: 200,
  });

  const {
    events,
    loading: loadingEvents,
    error: errorEvents,
    reload: reloadEvents,
  } = useTenantAdminEvents(50);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const [roleFormMode, setRoleFormMode] = useState<RoleFormMode>('create');
  const [roleEditing, setRoleEditing] = useState(false);
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
  const [bindingDeletingId, setBindingDeletingId] = useState<number | null>(
    null,
  );

  const [roleColors, setRoleColors] = useState<Record<number, string>>({});

  const selectedBindingUserId =
    selectedMemberId ||
    (bindingForm.userId.trim() ? bindingForm.userId.trim() : null);

  const {
    bindings: memberBindings,
    loading: loadingMemberBindings,
    error: errorMemberBindings,
    reload: reloadMemberBindings,
  } = useRoleBindings({
    userId: selectedBindingUserId ?? undefined,
    enabled: Boolean(selectedBindingUserId),
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

    if (selectedBindingUserId) reloadMemberBindings();
    if (selectedRole?.name) reloadRoleBindings();
  }, [
    reloadEvents,
    reloadMembers,
    reloadPermissions,
    reloadRoles,
    reloadMemberBindings,
    reloadRoleBindings,
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
      const stored = window.localStorage.getItem(
        `tenant-admin-role-colors:${tenantId}`,
      );
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

  const memberName = useCallback(
    (id: string) => {
      if (id === user?.id)
        return user.displayName || user.username || t('Вы', 'You');
      return formatMemberName(membersById.get(id));
    },
    [membersById, user, t],
  );

  const selectedMember = selectedMemberId
    ? (membersById.get(selectedMemberId) ?? null)
    : null;

  const normalizedPermissionKeys = useMemo(
    () =>
      Array.isArray(roleForm.permissionKeys) ? roleForm.permissionKeys : [],
    [roleForm.permissionKeys],
  );

  const serviceOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', content: t('Все сервисы', 'All services') },
      ...Array.from(new Set(roles.map((item) => item.service))).map(
        (service) => ({
          value: service,
          content: serviceLabel(service),
        }),
      ),
    ],
    [roles, t],
  );

  const permissionServiceOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', content: t('Все сервисы', 'All services') },
      ...Array.from(new Set(permissions.map((item) => item.service))).map(
        (service) => ({
          value: service,
          content: serviceLabel(service),
        }),
      ),
    ],
    [permissions, t],
  );

  const bindingRoleOptions = useMemo<SelectOption[]>(
    () =>
      roles.map((item) => ({
        value: String(item.id),
        content: `${roleLabel(item.name)} · ${serviceLabel(item.service)}`,
      })),
    [roles],
  );

  const filteredRoles = useMemo(
    () =>
      roles.filter((role) => {
        if (roleScopeFilter === 'template' && role.tenant_id !== null)
          return false;
        if (roleScopeFilter === 'tenant' && role.tenant_id === null)
          return false;
        if (roleServiceFilter && role.service !== roleServiceFilter)
          return false;
        return normalize(
          `${role.name} ${roleLabel(role.name)} ${serviceLabel(role.service)}`,
        ).includes(normalize(debouncedRoleQuery));
      }),
    [debouncedRoleQuery, roleScopeFilter, roleServiceFilter, roles],
  );

  const filteredPermissions = useMemo(() => {
    const query = normalize(debouncedPermissionQuery);
    return permissions.filter((permission) => {
      if (
        permissionServiceFilter &&
        permission.service !== permissionServiceFilter
      )
        return false;
      if (!query) return true;
      const haystack =
        `${permission.key} ${permission.description} ${permissionLabel(permission)}`.toLocaleLowerCase();
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
      if (
        rolePermissionServiceFilter &&
        permission.service !== rolePermissionServiceFilter
      )
        return false;
      if (!query) return true;
      const haystack =
        `${permission.key} ${permission.description} ${permissionLabel(permission)}`.toLocaleLowerCase();
      return haystack.includes(query);
    });
    return buildPermissionGroups(filtered);
  }, [debouncedRolePermissionQuery, permissions, rolePermissionServiceFilter]);

  const filteredEvents = useMemo(() => {
    const query = normalize(debouncedAuditQuery);
    if (!query) return events;
    return events.filter((event) => {
      const metadata = event.metadata
        ? JSON.stringify(event.metadata).toLocaleLowerCase()
        : '';
      return (
        normalize(
          Object.values(presentAuditEvent(event, roles, memberName)).join(' '),
        ).includes(query) ||
        event.action.toLocaleLowerCase().includes(query) ||
        event.target_type.toLocaleLowerCase().includes(query) ||
        (event.target_id ?? '').toLocaleLowerCase().includes(query) ||
        event.performed_by.toLocaleLowerCase().includes(query) ||
        metadata.includes(query)
      );
    });
  }, [debouncedAuditQuery, events, roles, memberName]);

  const memberRows = useMemo<MemberRow[]>(
    () =>
      members
        .filter((member) =>
          normalize(`${memberName(member.user_id)} ${member.user_id}`).includes(
            normalize(debouncedMemberQuery),
          ),
        )
        .map((member) => ({
          id: member.user_id,
          displayName: memberName(member.user_id),
          userId: member.user_id,
          createdAt: formatIsoDate(member.created_at),
          updatedAt: formatIsoDate(member.updated_at),
          initials: getInitials(member),
        })),
    [members, memberName, debouncedMemberQuery],
  );

  const getRoleColor = useCallback(
    (role: TenantRole) =>
      roleColors[role.id] ?? getRoleFallbackColor(role.name),
    [roleColors],
  );

  const setRoleColor = useCallback((roleId: number, color: string) => {
    setRoleColors((prev) => ({ ...prev, [roleId]: color }));
  }, []);

  const handleRoleSelect = useCallback(
    (role: TenantRole) => {
      setSelectedRole(role);
      setRoleEditing(false);
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
    setRoleEditing(true);
    setRoleTemplate(null);
    setRoleFormMode('create');
    setRoleForm({ service: 'portal', name: '', permissionKeys: [] });
    setRoleColorDraft(ROLE_COLOR_PALETTE[0]);
    setRolePanelTab('overview');
  }, []);

  const handleRoleSubmit = async () => {
    if (!canManageRoles || !roleForm.service.trim() || !roleForm.name.trim())
      return;

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
          title: t('Роль обновлена', 'Role updated'),
          content: t('Изменения сохранены', 'Changes saved'),
          theme: 'success',
        });
      } else {
        savedRole = await createTenantRole(payload);
        toaster.add({
          name: `role-${Date.now()}`,
          title: t('Роль создана', 'Role created'),
          content: roleTemplate
            ? t('Копия роли добавлена в каталог', 'Role copied')
            : t('Роль добавлена в каталог', 'Role added'),
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
      notifyApiError(
        error,
        t('Не удалось сохранить роль', 'Unable to save role'),
      );
    } finally {
      setSavingRole(false);
    }
  };

  const handleRoleDelete = async (role: TenantRole) => {
    if (!canManageRoles || role.tenant_id === null) return;

    if (!(await confirm(`Удалить роль «${role.name}»?`))) return;

    setDeletingRoleId(role.id);
    try {
      await deleteTenantRole(role.id);
      toaster.add({
        name: `role-${Date.now()}`,
        title: t('Роль удалена', 'Role deleted'),
        theme: 'success',
      });
      setRoleColors((prev) => {
        const next = { ...prev };
        delete next[role.id];
        return next;
      });
      resetRoleForm();
      reloadRoles();
      reloadEvents();
    } catch (error) {
      notifyApiError(
        error,
        t('Не удалось удалить роль', 'Unable to delete role'),
      );
    } finally {
      setDeletingRoleId(null);
    }
  };

  const handleBindingSubmit = async () => {
    if (
      bindingSaving ||
      !canManageBindings ||
      !bindingForm.userId.trim() ||
      !bindingForm.scopeId.trim() ||
      !bindingForm.roleId
    ) {
      return;
    }

    const selectedRoleName = roles.find(
      (role) => role.id === bindingForm.roleId,
    )?.name;
    if (
      !selectedRoleName ||
      !(await confirm(
        t(
          `Назначить роль «${roleLabel(selectedRoleName)}» участнику ${memberName(bindingForm.userId)}?`,
          `Assign “${roleLabel(selectedRoleName)}” to ${memberName(bindingForm.userId)}?`,
        ),
      ))
    )
      return;
    setBindingSaving(true);
    try {
      await createRoleBinding({
        tenant_id: tenantId,
        user_id: bindingForm.userId.trim(),
        scope_type: bindingForm.scopeType,
        scope_id: bindingForm.scopeId.trim(),
        role_id: bindingForm.roleId,
      });

      toaster.add({
        name: `binding-${Date.now()}`,
        title: t('Назначение создано', 'Role assigned'),
        theme: 'success',
      });

      setBindingForm((prev) => ({ ...prev, roleId: null }));

      reloadMemberBindings();
      reloadRoleBindings();
      reloadEvents();
    } catch (error) {
      notifyApiError(
        error,
        t('Не удалось назначить роль', 'Unable to assign role'),
      );
    } finally {
      setBindingSaving(false);
    }
  };

  const handleBindingDelete = async (bindingId: number) => {
    if (!canManageBindings) return;

    if (!(await confirm(t('Удалить назначение?', 'Remove this assignment?'))))
      return;

    setBindingDeletingId(bindingId);
    try {
      await deleteRoleBinding(bindingId);
      toaster.add({
        name: `binding-${Date.now()}`,
        title: t('Назначение удалено', 'Assignment removed'),
        theme: 'success',
      });
      reloadMemberBindings();
      reloadRoleBindings();
      reloadEvents();
    } catch (error) {
      notifyApiError(
        error,
        t('Не удалось удалить назначение', 'Unable to remove assignment'),
      );
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

  const handlePermissionToggle = useCallback(
    (key: string, checked: boolean) => {
      setRoleForm((prev) => {
        const next = new Set(prev.permissionKeys ?? []);
        if (checked) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return { ...prev, permissionKeys: Array.from(next) };
      });
    },
    [],
  );

  if (!user) return <StatusView kind="loading" />;

  if (!isAuthorized) {
    return (
      <StatusView
        kind="no-access"
        description={t(
          'Только администраторы сообщества могут управлять доступом',
          'Only community administrators can manage access',
        )}
      />
    );
  }

  return (
    <div className="tenant-admin">
      {confirmationDialog}
      <div className="tenant-admin__hero">
        <div>
          <h1 className="tenant-admin__title">
            {t('Управление сообществом', 'Community management')}
          </h1>
        </div>
        <div className="tenant-admin__hero-actions">
          {!canManageRoles && !canManageBindings ? (
            <Label theme="warning" size="s">
              {t('Только чтение', 'Read only')}
            </Label>
          ) : null}
          <Button view="outlined" size="m" onClick={refreshAll}>
            {t('Обновить', 'Refresh')}
          </Button>
        </div>
      </div>

      <div className="tenant-admin__layout">
        <SectionTabs
          label={t('Управление сообществом', 'Community management')}
          value={activeTab}
          items={[
            ...TAB_OPTIONS.map((item) => ({
              ...item,
              label: t(
                item.label,
                (
                  {
                    members: 'Members',
                    roles: 'Roles',
                    permissions: 'Permissions',
                    audit: 'Audit',
                  } as Record<string, string>
                )[item.id] ?? item.label,
              ),
            })),
            ...(user.isSuperuser
              ? [
                  {
                    id: 'applications' as TabKey,
                    label: t('Заявки', 'Applications'),
                  },
                ]
              : []),
          ]}
          onChange={setActiveTab}
        />
        <section className="tenant-admin__content">
          {((activeTab === 'members' && errorMembers) ||
            (activeTab === 'roles' && errorRoles) ||
            (activeTab === 'permissions' && errorPermissions) ||
            (activeTab === 'audit' && errorEvents)) && (
            <InlineError onRetry={refreshAll}>
              {t(
                'Не удалось загрузить этот раздел.',
                'Unable to load this section.',
              )}
            </InlineError>
          )}

          {activeTab === 'applications' &&
            (user.isSuperuser ? (
              <AdminApplicationsPage embedded />
            ) : (
              <p>
                {t(
                  'Рассмотрение заявок доступно системному администратору.',
                  'Only system administrators can review account applications.',
                )}
              </p>
            ))}
          {activeTab === 'members' && (
            <div className="tenant-admin__panel">
              <div className="tenant-admin__panel-header">
                <div>
                  <h2>{t('Участники', 'Members')}</h2>
                </div>
              </div>

              <div className="tenant-admin__panel-grid tenant-admin__panel-grid--members">
                <Card className="tenant-admin__card">
                  <div className="tenant-admin__card-head">
                    <div className="tenant-admin__search">
                      <TextInput
                        size="xl"
                        value={memberQuery}
                        placeholder={t(
                          'Поиск по имени или ID',
                          'Find a member',
                        )}
                        onUpdate={(value) => setMemberQuery(value)}
                        startContent={<Icon data={Magnifier} size={16} />}
                      />
                    </div>
                  </div>

                  {loadingMembers ? (
                    <div className="tenant-admin__loader">
                      <Loader size="m" />
                      <span>
                        {t('Загружаем участников...', 'Loading members…')}
                      </span>
                    </div>
                  ) : errorMembers ? null : memberRows.length === 0 ? (
                    <div className="tenant-admin__empty">
                      {t(
                        'Никого не нашли. Попробуйте изменить запрос.',
                        'No members found. Try another name.',
                      )}
                    </div>
                  ) : (
                    <div className="tenant-admin__mobile-members">
                      {memberRows.map((member) => (
                        <button
                          type="button"
                          key={member.id}
                          onClick={() => setSelectedMemberId(member.userId)}
                        >
                          <MemberAvatar
                            size="m"
                            userId={member.userId}
                            text={member.initials}
                          />
                          <span className="tenant-member-summary">
                            <strong>{member.displayName}</strong>
                            <small>
                              {t('В сообществе с', 'Joined')} {member.createdAt}
                            </small>
                          </span>
                          <span aria-hidden="true">→</span>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>

                <AdminDetailPanel
                  title={t('Участник сообщества', 'Community member')}
                  open={Boolean(selectedMemberId)}
                  busy={bindingSaving || Boolean(bindingDeletingId)}
                  onClose={() => setSelectedMemberId(null)}
                >
                  <div className="tenant-admin__member-card">
                    <MemberAvatar
                      size="l"
                      userId={selectedMemberId ?? undefined}
                      text={getInitials(selectedMember)}
                    />
                    <div>
                      <div className="tenant-admin__member-name">
                        {selectedMember
                          ? memberName(selectedMember.user_id)
                          : (selectedMemberId ??
                            t('Не выбран', 'Not selected'))}
                      </div>
                      <div className="tenant-admin__member-meta">
                        {selectedMember
                          ? t('Участник сообщества', 'Community member')
                          : t(
                              'Выберите пользователя из списка',
                              'Select a member',
                            )}
                      </div>
                    </div>
                  </div>

                  <div className="tenant-admin__section">
                    <div className="tenant-admin__section-head">
                      <span>{t('Текущие роли', 'Assigned roles')}</span>
                      {!canManageBindings && (
                        <Label theme="warning" size="s">
                          {t(
                            'Нет прав на изменение',
                            'You cannot change assignments',
                          )}
                        </Label>
                      )}
                    </div>

                    {!selectedBindingUserId ? (
                      <div className="tenant-admin__empty">
                        {t(
                          'Сначала выберите пользователя.',
                          'Select a member first.',
                        )}
                      </div>
                    ) : loadingMemberBindings ? (
                      <div className="tenant-admin__loader">
                        <Loader size="s" />
                        <span>
                          {t('Загружаем назначения...', 'Loading assignments…')}
                        </span>
                      </div>
                    ) : errorMemberBindings ? (
                      <InlineError onRetry={() => void reloadMemberBindings()}>
                        {t(
                          'Не удалось загрузить роли участника.',
                          'Unable to load this member’s roles.',
                        )}
                      </InlineError>
                    ) : memberBindings.length === 0 ? (
                      <div className="tenant-admin__empty">
                        {t('Назначений пока нет.', 'No roles assigned.')}
                      </div>
                    ) : (
                      <div className="tenant-admin__binding-list">
                        {memberBindings.map((binding) => (
                          <div
                            key={binding.id}
                            className="tenant-admin__binding-item"
                          >
                            <div>
                              <div className="tenant-admin__binding-title">
                                {roleLabel(binding.role_name)}
                              </div>
                              <div className="tenant-admin__binding-meta">
                                {serviceLabel(binding.role_service)} ·{' '}
                                {scopeLabel(
                                  binding.scope_type,
                                  binding.scope_id,
                                  tenantId,
                                )}
                              </div>
                            </div>
                            {canManageBindings && (
                              <Button
                                view="flat"
                                size="s"
                                disabled={bindingDeletingId === binding.id}
                                onClick={() => handleBindingDelete(binding.id)}
                              >
                                {bindingDeletingId === binding.id
                                  ? t('Удаление…', 'Removing…')
                                  : t('Удалить', 'Delete')}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="tenant-admin__section">
                    <div className="tenant-admin__section-head">
                      {t('Назначить роль', 'Assign role')}
                    </div>

                    <Select
                      size="xl"
                      options={bindingRoleOptions}
                      value={
                        bindingForm.roleId ? [String(bindingForm.roleId)] : []
                      }
                      onUpdate={(value) =>
                        setBindingForm((prev) => ({
                          ...prev,
                          roleId: value[0] ? Number(value[0]) : null,
                        }))
                      }
                      placeholder={t('Роль', 'Role')}
                      aria-label={t('Роль', 'Role')}
                      width="max"
                      disabled={!canManageBindings}
                    />

                    <ScopePicker
                      type={bindingForm.scopeType}
                      id={bindingForm.scopeId}
                      disabled={!canManageBindings || bindingSaving}
                      onChange={(scopeType, scopeId) =>
                        setBindingForm((current) => ({
                          ...current,
                          scopeType,
                          scopeId,
                        }))
                      }
                    />

                    <Button
                      view="action"
                      loading={bindingSaving}
                      onClick={handleBindingSubmit}
                      disabled={
                        !canManageBindings ||
                        bindingSaving ||
                        !bindingForm.roleId ||
                        !bindingForm.scopeId
                      }
                    >
                      {t('Назначить роль', 'Assign role')}
                    </Button>
                  </div>
                </AdminDetailPanel>
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="tenant-admin__panel">
              <div className="tenant-admin__panel-header">
                <div>
                  <h2>{t('Роли и доступы', 'Roles and access')}</h2>
                </div>
                <Button
                  view="action"
                  size="m"
                  onClick={resetRoleForm}
                  disabled={!canManageRoles}
                >
                  <Icon data={Plus} size={14} /> {t('Новая роль', 'New role')}
                </Button>
              </div>

              <div className="tenant-admin__panel-grid">
                <Card className="tenant-admin__card">
                  <div className="tenant-admin__role-filters">
                    <TextInput
                      size="xl"
                      value={roleQuery}
                      placeholder={t('Поиск по названию роли', 'Find a role')}
                      onUpdate={(value) => setRoleQuery(value)}
                      startContent={<Icon data={Magnifier} size={16} />}
                    />
                    <Select
                      size="xl"
                      options={serviceOptions}
                      value={roleServiceFilter ? [roleServiceFilter] : []}
                      onUpdate={(value) => setRoleServiceFilter(value[0] ?? '')}
                      placeholder={t('Сервис', 'Service')}
                    />
                    <Select
                      size="xl"
                      options={ROLE_SCOPE_OPTIONS.map((option) => ({
                        ...option,
                        content: t(
                          option.content,
                          {
                            all: 'All roles',
                            tenant: 'Community roles',
                            template: 'System templates',
                          }[option.value],
                        ),
                      }))}
                      value={[roleScopeFilter]}
                      onUpdate={(value) =>
                        setRoleScopeFilter(
                          (value[0] ?? 'all') as typeof roleScopeFilter,
                        )
                      }
                    />
                  </div>

                  {loadingRoles ? (
                    <div className="tenant-admin__loader">
                      <Loader size="m" />
                      <span>{t('Загружаем роли...', 'Loading roles…')}</span>
                    </div>
                  ) : filteredRoles.length === 0 ? (
                    <div className="tenant-admin__empty">
                      {t('Ролей не найдено.', 'No roles found.')}
                    </div>
                  ) : (
                    <div className="tenant-admin__role-list">
                      {filteredRoles.map((role) => {
                        const isTemplate = role.tenant_id === null;
                        const isSelected = selectedRole?.id === role.id;
                        const permissionCount =
                          role.permission_keys?.length ?? 0;
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
                              <span className="tenant-admin__role-title">
                                {roleLabel(role.name)}
                              </span>
                              <span className="tenant-admin__role-meta">
                                {serviceLabel(role.service)}
                              </span>
                            </span>
                            <span className="tenant-admin__role-tags">
                              {isTemplate ? (
                                <Label theme="normal" size="s">
                                  {t('Шаблон', 'Template')}
                                </Label>
                              ) : null}
                              <Label theme="info" size="s">
                                {t('Права:', 'Permissions:')}
                                {permissionCount}
                              </Label>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <AdminDetailPanel
                  title={
                    selectedRole
                      ? roleLabel(selectedRole.name)
                      : t('Новая роль', 'New role')
                  }
                  open={Boolean(selectedRole || roleEditing)}
                  busy={savingRole}
                  onClose={() =>
                    void (async () => {
                      if (
                        roleEditing &&
                        !(await confirm(
                          t(
                            'Закрыть редактирование роли? Несохранённые изменения будут потеряны.',
                            'Discard unsaved role changes?',
                          ),
                        ))
                      )
                        return;
                      setSelectedRole(null);
                      setRoleEditing(false);
                    })()
                  }
                >
                  <div className="tenant-admin__card-head">
                    <div>
                      <div className="tenant-admin__card-title">
                        {selectedRole
                          ? roleLabel(selectedRole.name)
                          : roleEditing
                            ? t('Создание роли', 'Create role')
                            : t('Информация о роли', 'Role details')}
                      </div>
                      <div className="tenant-admin__card-subtitle">
                        {selectedRole
                          ? `Выбрана роль: ${roleLabel(selectedRole.name)}`
                          : roleEditing
                            ? t(
                                'Создайте новую роль для сообщества.',
                                'Create a role for your community.',
                              )
                            : t('Выберите роль в каталоге.', 'Select a role.')}
                      </div>
                    </div>
                    {selectedRole && (
                      <Button
                        view="outlined"
                        size="s"
                        disabled={!canManageRoles}
                        onClick={() =>
                          roleEditing
                            ? handleRoleSelect(selectedRole)
                            : setRoleEditing(true)
                        }
                      >
                        {roleEditing
                          ? t('Отменить', 'Cancel')
                          : isTemplateSelected
                            ? t('Создать на основе', 'Use as template')
                            : t('Редактировать', 'Edit')}
                      </Button>
                    )}
                  </div>

                  {(selectedRole || roleEditing) && (
                    <>
                      <div className="tenant-admin__role-tabs">
                        {(
                          [
                            'overview',
                            'permissions',
                            'members',
                          ] as RolePanelTab[]
                        ).map((tab) => (
                          <Button
                            key={tab}
                            view={rolePanelTab === tab ? 'action' : 'outlined'}
                            size="s"
                            onClick={() => setRolePanelTab(tab)}
                          >
                            {tab === 'overview'
                              ? t('Общее', 'Overview')
                              : tab === 'permissions'
                                ? t('Права', 'Permissions')
                                : t('Участники', 'Members')}
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
                              <div className="tenant-admin__role-title">
                                {roleForm.name
                                  ? roleLabel(roleForm.name)
                                  : t('Новая роль', 'New role')}
                              </div>
                              <div className="tenant-admin__role-meta">
                                {serviceLabel(roleForm.service)}
                              </div>
                            </div>
                          </div>

                          {isTemplateSelected && (
                            <Label theme="normal" size="s">
                              {t(
                                'Системный шаблон для создания собственных ролей',
                                'System template for custom roles',
                              )}
                            </Label>
                          )}

                          {roleEditing && (
                            <>
                              <div className="tenant-admin__field">
                                <label className="tenant-admin__field-label">
                                  {t('Название роли', 'Role name')}
                                </label>
                                <TextInput
                                  size="xl"
                                  value={roleForm.name}
                                  onUpdate={(value) =>
                                    setRoleForm((prev) => ({
                                      ...prev,
                                      name: value,
                                    }))
                                  }
                                  disabled={!canManageRoles}
                                />
                              </div>

                              <div className="tenant-admin__field">
                                <label className="tenant-admin__field-label">
                                  {t('Раздел платформы', 'Service')}
                                </label>
                                <Select
                                  size="xl"
                                  options={permissionServiceOptions.filter(
                                    (option) => option.value,
                                  )}
                                  value={[roleForm.service]}
                                  onUpdate={(value) =>
                                    setRoleForm((prev) => ({
                                      ...prev,
                                      service: value[0] ?? prev.service,
                                    }))
                                  }
                                  disabled={!canManageRoles}
                                />
                              </div>

                              <div className="tenant-admin__field">
                                <label className="tenant-admin__field-label">
                                  {t('Цвет роли', 'Role colour')}
                                </label>
                                <div className="tenant-admin__color-field">
                                  <input
                                    className="tenant-admin__color-input"
                                    type="color"
                                    value={roleColorDraft}
                                    onChange={(event) =>
                                      setRoleColorDraft(event.target.value)
                                    }
                                    disabled={!canManageRoles}
                                  />
                                  <span className="tenant-admin__field-hint">
                                    {t(
                                      'Цвет хранится локально, чтобы сразу видеть\n                                    роли в списке.',
                                      'Colour is saved on this device.',
                                    )}
                                  </span>
                                </div>
                              </div>
                            </>
                          )}
                          <div className="tenant-admin__field">
                            <label className="tenant-admin__field-label">
                              {t('Доступные действия', 'Allowed actions')}
                            </label>
                            <div className="tenant-admin__permission-preview">
                              {normalizedPermissionKeys.length === 0 ? (
                                <div className="tenant-admin__empty">
                                  {t('Пока нет прав.', 'No permissions yet.')}
                                </div>
                              ) : (
                                normalizedPermissionKeys.map((permission) => (
                                  <Label key={permission} theme="info" size="s">
                                    {permissionLabel(permission)}
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
                              size="xl"
                              value={rolePermissionQuery}
                              placeholder={t(
                                'Поиск по ключу или описанию',
                                'Find a permission',
                              )}
                              onUpdate={(value) =>
                                setRolePermissionQuery(value)
                              }
                              startContent={<Icon data={Magnifier} size={16} />}
                            />
                            <Select
                              size="xl"
                              options={permissionServiceOptions}
                              value={
                                rolePermissionServiceFilter
                                  ? [rolePermissionServiceFilter]
                                  : []
                              }
                              onUpdate={(value) =>
                                setRolePermissionServiceFilter(value[0] ?? '')
                              }
                              placeholder={t('Сервис', 'Service')}
                            />
                            <Button
                              view="flat"
                              size="s"
                              disabled={!canManageRoles || !roleEditing}
                              onClick={() =>
                                setRoleForm((prev) => ({
                                  ...prev,
                                  permissionKeys: [],
                                }))
                              }
                            >
                              {t('Очистить', 'Clear')}
                            </Button>
                          </div>

                          {loadingPermissions ? (
                            <div className="tenant-admin__loader">
                              <Loader size="s" />
                              <span>
                                {t(
                                  'Загружаем права...',
                                  'Loading permissions…',
                                )}
                              </span>
                            </div>
                          ) : rolePermissionGroups.length === 0 ? (
                            <div className="tenant-admin__empty">
                              {t('Совпадений не найдено.', 'No matches.')}
                            </div>
                          ) : (
                            <div className="tenant-admin__permission-groups">
                              {rolePermissionGroups.map((group) => (
                                <div
                                  key={group.service}
                                  className="tenant-admin__permission-service"
                                >
                                  <div className="tenant-admin__permission-service-head">
                                    <span>{serviceLabel(group.service)}</span>
                                    <Label theme="normal" size="s">
                                      {group.resources.reduce(
                                        (acc, resource) =>
                                          acc + resource.items.length,
                                        0,
                                      )}
                                    </Label>
                                  </div>
                                  {group.resources.map((resource) => (
                                    <div
                                      key={resourceLabel(resource.resource)}
                                      className="tenant-admin__permission-group"
                                    >
                                      <div className="tenant-admin__permission-group-title">
                                        {resourceLabel(resource.resource)}
                                      </div>
                                      <div className="tenant-admin__permission-list">
                                        {resource.items.map((permission) => {
                                          const isSelected =
                                            normalizedPermissionKeys.includes(
                                              permission.key,
                                            );
                                          return (
                                            <div
                                              key={permission.key}
                                              className="tenant-admin__permission-row"
                                            >
                                              <div>
                                                <div className="tenant-admin__permission-key">
                                                  {permissionLabel(permission)}
                                                </div>
                                                <div className="tenant-admin__permission-desc">
                                                  <details>
                                                    <summary>
                                                      {t(
                                                        'Технический ключ',
                                                        'Technical key',
                                                      )}
                                                    </summary>
                                                    <code>
                                                      {permission.key}
                                                    </code>
                                                  </details>
                                                </div>
                                              </div>
                                              <Switch
                                                size="m"
                                                aria-label={permissionLabel(
                                                  permission,
                                                )}
                                                checked={isSelected}
                                                disabled={
                                                  !canManageRoles ||
                                                  !roleEditing
                                                }
                                                onUpdate={(checked) =>
                                                  handlePermissionToggle(
                                                    permission.key,
                                                    checked,
                                                  )
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
                                <span>
                                  {t(
                                    'Загружаем участников роли...',
                                    'Loading role members…',
                                  )}
                                </span>
                              </div>
                            ) : roleBindingsForSelected.length === 0 ? (
                              <div className="tenant-admin__empty">
                                {t(
                                  'Эта роль никому не назначена.',
                                  'This role has no members.',
                                )}
                              </div>
                            ) : (
                              <div className="tenant-admin__role-members-list">
                                {roleBindingsForSelected.map((binding) => {
                                  const member = membersById.get(
                                    binding.user_id,
                                  );
                                  return (
                                    <div
                                      key={binding.id}
                                      className="tenant-admin__role-member"
                                    >
                                      <MemberAvatar
                                        size="s"
                                        userId={binding.user_id}
                                        text={getInitials(member)}
                                      />
                                      <div>
                                        <div className="tenant-admin__member-name">
                                          {memberName(binding.user_id)}
                                        </div>
                                        <div className="tenant-admin__member-meta">
                                          {scopeLabel(
                                            binding.scope_type,
                                            binding.scope_id,
                                            tenantId,
                                          )}
                                        </div>
                                      </div>
                                      <Button
                                        view="flat"
                                        size="s"
                                        onClick={() =>
                                          setSelectedMemberId(binding.user_id)
                                        }
                                      >
                                        {t('Открыть', 'Open')}
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            )
                          ) : (
                            <div className="tenant-admin__empty">
                              {t(
                                'Выберите роль слева, чтобы увидеть участников.',
                                'Select a role to see its members.',
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {roleEditing && (
                        <div className="tenant-admin__role-actions">
                          <Button
                            view="action"
                            loading={savingRole}
                            onClick={handleRoleSubmit}
                            disabled={!canManageRoles}
                          >
                            {roleFormMode === 'edit'
                              ? t('Сохранить изменения', 'Save changes')
                              : t('Создать роль', 'Create role')}
                          </Button>
                          {selectedRole && !isTemplateSelected && (
                            <Button
                              view="outlined"
                              disabled={
                                Boolean(deletingRoleId) || !canManageRoles
                              }
                              onClick={() => handleRoleDelete(selectedRole)}
                            >
                              {deletingRoleId === selectedRole.id
                                ? t('Удаление…', 'Removing…')
                                : t('Удалить роль', 'Delete role')}
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </AdminDetailPanel>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="tenant-admin__panel">
              <div className="tenant-admin__panel-header">
                <div>
                  <h2>{t('Каталог прав', 'Permissions')}</h2>
                </div>
              </div>

              <Card className="tenant-admin__card">
                {!canViewPermissions ? (
                  <div className="tenant-admin__empty">
                    {t(
                      'Нет доступа к каталогу прав.',
                      'Access to permissions is restricted.',
                    )}
                  </div>
                ) : (
                  <>
                    <div className="tenant-admin__permission-toolbar">
                      <TextInput
                        size="xl"
                        value={permissionQuery}
                        placeholder={t(
                          'Поиск по ключу или описанию',
                          'Find a permission',
                        )}
                        onUpdate={(value) => setPermissionQuery(value)}
                        startContent={<Icon data={Magnifier} size={16} />}
                      />
                      <Select
                        size="xl"
                        options={permissionServiceOptions}
                        value={
                          permissionServiceFilter
                            ? [permissionServiceFilter]
                            : []
                        }
                        onUpdate={(value) =>
                          setPermissionServiceFilter(value[0] ?? '')
                        }
                        placeholder={t('Сервис', 'Service')}
                      />
                    </div>

                    {loadingPermissions ? (
                      <div className="tenant-admin__loader">
                        <Loader size="m" />
                        <span>
                          {t('Загружаем права...', 'Loading permissions…')}
                        </span>
                      </div>
                    ) : permissionGroups.length === 0 ? (
                      <div className="tenant-admin__empty">
                        {t('Ничего не найдено.', 'No matches.')}
                      </div>
                    ) : (
                      <div className="tenant-admin__permission-groups">
                        {permissionGroups.map((group) => (
                          <div
                            key={group.service}
                            className="tenant-admin__permission-service"
                          >
                            <div className="tenant-admin__permission-service-head">
                              <span>{serviceLabel(group.service)}</span>
                              <Label theme="normal" size="s">
                                {group.resources.reduce(
                                  (acc, resource) =>
                                    acc + resource.items.length,
                                  0,
                                )}
                              </Label>
                            </div>
                            {group.resources.map((resource) => (
                              <div
                                key={resourceLabel(resource.resource)}
                                className="tenant-admin__permission-group"
                              >
                                {resourceLabel(resource.resource) !==
                                  serviceLabel(group.service) && (
                                  <div className="tenant-admin__permission-group-title">
                                    {resourceLabel(resource.resource)}
                                  </div>
                                )}
                                <div className="tenant-admin__permission-list">
                                  {resource.items.map((permission) => (
                                    <div
                                      key={permission.key}
                                      className="tenant-admin__permission-row"
                                    >
                                      <div>
                                        <div className="tenant-admin__permission-key">
                                          {permissionLabel(permission)}
                                        </div>
                                        <div className="tenant-admin__permission-desc">
                                          <details>
                                            <summary>
                                              {t(
                                                'Технический ключ',
                                                'Technical key',
                                              )}
                                            </summary>
                                            <code>{permission.key}</code>
                                          </details>
                                        </div>
                                      </div>
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
                  <h2>{t('Аудит действий', 'Access history')}</h2>
                  <p>
                    {t(
                      'Последние 50 изменений ролей и прав участников.',
                      'The 50 most recent changes to roles and member access.',
                    )}
                  </p>
                </div>
              </div>

              <Card className="tenant-admin__card">
                <TextInput
                  size="xl"
                  value={auditQuery}
                  placeholder={t(
                    'Поиск по действию, пользователю или роли',
                    'Find an action, member or role',
                  )}
                  onUpdate={(value) => setAuditQuery(value)}
                  startContent={<Icon data={Magnifier} size={16} />}
                />

                {loadingEvents ? (
                  <div className="tenant-admin__loader">
                    <Loader size="m" />
                    <span>{t('Загружаем события...', 'Loading history…')}</span>
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="tenant-admin__empty">
                    {t('Событий пока нет.', 'No changes yet.')}
                  </div>
                ) : (
                  <div className="tenant-admin__audit-list">
                    {filteredEvents.map((event) => {
                      const summary = presentAuditEvent(
                        event,
                        roles,
                        memberName,
                      );
                      return (
                        <article
                          key={event.id}
                          className="tenant-admin__audit-item"
                        >
                          <div className="tenant-admin__audit-head">
                            <h3 className="tenant-admin__audit-action">
                              {summary.title}
                            </h3>
                            <time dateTime={event.created_at}>
                              {formatIsoDate(event.created_at)}
                            </time>
                          </div>
                          <p className="tenant-admin__audit-description">
                            {summary.description}
                          </p>
                          <p className="tenant-admin__audit-meta">
                            {t('Изменил:', 'Changed by:')} {summary.actor}
                          </p>
                          <details className="tenant-admin__technical-details">
                            <summary>
                              {t('Технические данные', 'Technical details')}
                            </summary>
                            <dl>
                              <div>
                                <dt>{t('Код события', 'Event code')}</dt>
                                <dd>{event.action}</dd>
                              </div>
                              <div>
                                <dt>{t('Идентификатор', 'Identifier')}</dt>
                                <dd>{event.id}</dd>
                              </div>
                              <div>
                                <dt>{t('Исполнитель', 'Actor')}</dt>
                                <dd>{event.performed_by}</dd>
                              </div>
                              <div>
                                <dt>{t('Объект', 'Object')}</dt>
                                <dd>
                                  {event.target_type} · {event.target_id ?? '—'}
                                </dd>
                              </div>
                            </dl>
                            <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
                          </details>
                        </article>
                      );
                    })}
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
