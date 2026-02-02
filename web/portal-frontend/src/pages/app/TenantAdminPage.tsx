import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Icon,
  Label,
  Loader,
  Select,
  TextInput,
  type SelectOption,
} from '@gravity-ui/uikit';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Plus from '@gravity-ui/icons/Plus';
import Person from '@gravity-ui/icons/Person';
import Shield from '@gravity-ui/icons/Shield';

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
import type { ScopeType, TenantMember, TenantRole } from '../../modules/tenantAdmin/api';
import {
  usePermissionCatalog,
  useRoleBindings,
  useTenantAdminEvents,
  useTenantMembers,
  useTenantRoles,
} from '../../modules/tenantAdmin/hooks';

const SCOPE_LABELS: Record<ScopeType, string> = {
  GLOBAL: 'Глобальный',
  TENANT: 'Тенант',
  COMMUNITY: 'Сообщество',
  TEAM: 'Команда',
  SERVICE: 'Сервис',
};

const ROLE_SCOPE_OPTIONS: Array<{ value: 'all' | 'tenant' | 'template'; content: string }> = [
  { value: 'all', content: 'Все роли' },
  { value: 'tenant', content: 'Только роли тенанта' },
  { value: 'template', content: 'Шаблоны системы' },
];

type TabKey = 'members' | 'roles' | 'permissions' | 'audit';

type RoleFormMode = 'create' | 'edit' | 'clone';

const TAB_OPTIONS: Array<{ id: TabKey; label: string; description: string }> = [
  { id: 'members', label: 'Участники', description: 'Поиск людей, назначение ролей и областей' },
  { id: 'roles', label: 'Роли', description: 'Каталог ролей и настройка прав' },
  { id: 'permissions', label: 'Права', description: 'Каталог permission-ключей' },
  { id: 'audit', label: 'Журнал', description: 'История изменений и аудит' },
];

const formatMemberName = (member: TenantMember | null | undefined) => {
  if (!member) return 'Неизвестный пользователь';
  const name = [member.first_name, member.last_name].filter(Boolean).join(' ').trim();
  return name || member.user_id;
};

const formatIsoDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');

const normalize = (value: string) => value.trim().toLocaleLowerCase();

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

  const [activeTab, setActiveTab] = useState<TabKey>('members');

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

  const refreshAll = useCallback(() => {
    reloadRoles();
    reloadMembers();
    reloadEvents();
    reloadPermissions();

    if (roleSearchEnabled) reloadRoleSearch();
    if (selectedBindingUserId) reloadMemberBindings();
  }, [
    reloadEvents,
    reloadMembers,
    reloadPermissions,
    reloadRoles,
    reloadRoleSearch,
    reloadMemberBindings,
    roleSearchEnabled,
    selectedBindingUserId,
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

  const permissionOptions = useMemo<SelectOption[]>(
    () =>
      permissions.map((item) => ({
        value: item.key,
        content: `${item.key} — ${item.description}`,
      })),
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

  const permissionGroups = useMemo(() => {
    const grouped = new Map<string, typeof filteredPermissions>();
    filteredPermissions.forEach((permission) => {
      const existing = grouped.get(permission.service) ?? [];
      existing.push(permission);
      grouped.set(permission.service, existing);
    });
    return Array.from(grouped.entries()).map(([service, items]) => ({ service, items }));
  }, [filteredPermissions]);

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

  const handleRoleEdit = (role: TenantRole) => {
    setSelectedRole(role);
    setRoleTemplate(null);
    setRoleFormMode('edit');
    setRoleForm({
      service: role.service,
      name: role.name,
      permissionKeys: role.permission_keys ?? [],
    });
  };

  const handleRoleClone = (role: TenantRole) => {
    setSelectedRole(null);
    setRoleTemplate(role);
    setRoleFormMode('clone');
    setRoleForm({
      service: role.service,
      name: role.name,
      permissionKeys: role.permission_keys ?? [],
    });
  };

  const resetRoleForm = () => {
    setSelectedRole(null);
    setRoleTemplate(null);
    setRoleFormMode('create');
    setRoleForm({ service: 'portal', name: '', permissionKeys: [] });
  };

  const handleRoleSubmit = async () => {
    if (!canManageRoles || !roleForm.service.trim() || !roleForm.name.trim()) return;

    setSavingRole(true);
    try {
      const payload = {
        service: roleForm.service.trim(),
        name: roleForm.name.trim(),
        permission_keys: normalizedPermissionKeys,
      };

      if (selectedRole) {
        await updateTenantRole(selectedRole.id, payload);
        toaster.add({
          name: `role-${Date.now()}`,
          title: 'Роль обновлена',
          content: 'Изменения сохранены',
          theme: 'success',
        });
      } else {
        await createTenantRole(payload);
        toaster.add({
          name: `role-${Date.now()}`,
          title: 'Роль создана',
          content: roleTemplate ? 'Копия роли добавлена в каталог' : 'Роль добавлена в каталог',
          theme: 'success',
        });
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
      reloadEvents();
    } catch (error) {
      notifyApiError(error, 'Не удалось удалить назначение');
    } finally {
      setBindingDeletingId(null);
    }
  };

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
    <div className="container py-6 space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-gray-500">Tenant Admin Center</p>
            <h1 className="text-2xl font-semibold text-gray-900">Права, роли и аудит</h1>
            <p className="text-sm text-gray-500 mt-1">
              Управляйте доступом участников внутри текущего тенанта без обращения к техподдержке.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!canManageRoles && !canManageBindings ? (
              <Label theme="warning" size="s">
                Доступ только для чтения
              </Label>
            ) : null}
            <Button view="flat" size="m" onClick={refreshAll}>
              Обновить данные
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {TAB_OPTIONS.map((tab) => (
            <Button
              key={tab.id}
              size="s"
              view={activeTab === tab.id ? 'action' : 'outlined'}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4 bg-gray-50 border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Icon data={Person} size={16} /> Участники
            </div>
            <div className="text-2xl font-semibold text-gray-900 mt-2">{members.length}</div>
            <div className="text-xs text-gray-500 mt-1">Показано по запросу</div>
          </Card>
          <Card className="p-4 bg-gray-50 border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Icon data={Shield} size={16} /> Роли
            </div>
            <div className="text-2xl font-semibold text-gray-900 mt-2">{roles.length}</div>
            <div className="text-xs text-gray-500 mt-1">В каталоге тенанта</div>
          </Card>
          <Card className="p-4 bg-gray-50 border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500">Доступов к управлению</div>
            <div className="text-2xl font-semibold text-gray-900 mt-2">
              {canManageRoles || canManageBindings ? 'Полный' : 'Только чтение'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Основано на portal.roles.*</div>
          </Card>
          <Card className="p-4 bg-gray-50 border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500">Последнее событие</div>
            <div className="text-base font-semibold text-gray-900 mt-2">
              {events[0]?.action ?? 'Нет данных'}
            </div>
            <div className="text-xs text-gray-500 mt-1">{formatIsoDate(events[0]?.created_at)}</div>
          </Card>
        </div>
      </div>

      {activeTab === 'members' && (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="p-5 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Участники и назначения</h2>
              <p className="text-sm text-gray-500">
                Сначала найдите участника или роль, затем управляйте назначениями.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <TextInput
                value={memberQuery}
                placeholder="Поиск участника по имени или ID"
                onUpdate={(value) => setMemberQuery(value)}
                startContent={<Icon data={Magnifier} size={16} />}
              />
              <TextInput
                value={roleSearchQuery}
                placeholder="Поиск по роли (например, Модератор)"
                onUpdate={(value) => setRoleSearchQuery(value)}
                startContent={<Icon data={Magnifier} size={16} />}
              />
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-gray-700">Список участников</div>
              {loadingMembers ? (
                <Loader size="m" />
              ) : members.length === 0 ? (
                <p className="text-sm text-gray-500">Никого не нашли. Попробуйте изменить запрос.</p>
              ) : (
                <div className="grid gap-2">
                  {members.map((member) => {
                    const isSelected = member.user_id === selectedMemberId;
                    return (
                      <button
                        key={member.user_id}
                        type="button"
                        onClick={() => setSelectedMemberId(member.user_id)}
                        className={`text-left border rounded-lg p-3 transition ${
                          isSelected
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="text-sm font-semibold text-gray-900">
                            {formatMemberName(member)}
                          </div>
                          <div className="text-xs text-gray-500">{member.user_id}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-gray-700">Результаты по ролям</div>
              {!roleSearchEnabled ? (
                <p className="text-sm text-gray-500">
                  Введите название роли, чтобы увидеть всех пользователей с ней.
                </p>
              ) : loadingRoleSearch ? (
                <Loader size="m" />
              ) : roleSearchBindings.length === 0 ? (
                <p className="text-sm text-gray-500">Совпадений по ролям не найдено.</p>
              ) : (
                <div className="space-y-3">
                  {roleSearchGroups.map((group) => (
                    <div
                      key={group.roleName}
                      className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-900">{group.roleName}</div>
                        <Label theme="info" size="s">
                          {group.bindings.length}
                        </Label>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.bindings.map((binding) => {
                          const member = membersById.get(binding.user_id);
                          const label = member ? formatMemberName(member) : binding.user_id;
                          return (
                            <Button
                              key={`${binding.id}-${binding.user_id}`}
                              view="flat"
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

          <Card className="p-5 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Карточка участника</h3>
                <p className="text-sm text-gray-500">
                  Выберите пользователя, чтобы управлять его доступом.
                </p>
              </div>
              {selectedMemberId && (
                <Button view="outlined" size="s" onClick={() => setSelectedMemberId(null)}>
                  Сбросить
                </Button>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm text-gray-500">Пользователь</div>
              <div className="text-base font-semibold text-gray-900">
                {selectedMember
                  ? formatMemberName(selectedMember)
                  : selectedMemberId ?? 'Не выбран'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {selectedMember
                  ? selectedMember.user_id
                  : selectedMemberId ?? 'Выберите пользователя из списка'}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-gray-700">Текущие назначения</div>
              {!selectedBindingUserId ? (
                <p className="text-sm text-gray-500">Сначала выберите пользователя.</p>
              ) : loadingMemberBindings ? (
                <Loader size="m" />
              ) : memberBindings.length === 0 ? (
                <p className="text-sm text-gray-500">Назначений пока нет.</p>
              ) : (
                <div className="space-y-2">
                  {memberBindings.map((binding) => (
                    <div key={binding.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {binding.role_name}
                          </div>
                          <div className="text-xs text-gray-500">
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
                      <div className="text-xs text-gray-400 mt-1">
                        {formatIsoDate(binding.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-700">Назначить роль</div>
                {!canManageBindings && (
                  <Label theme="warning" size="s">
                    Нет прав на изменение
                  </Label>
                )}
              </div>

              <TextInput
                placeholder="User ID"
                value={bindingForm.userId}
                onUpdate={(value) => setBindingForm((prev) => ({ ...prev, userId: value }))}
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

              <div className="grid gap-2 md:grid-cols-2">
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
          </Card>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Каталог ролей</h2>
              <p className="text-sm text-gray-500">Настраивайте роли, которые затем назначаются участникам.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
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
              <Loader size="l" />
            ) : filteredRoles.length === 0 ? (
              <p className="text-sm text-gray-500">Ролей не найдено.</p>
            ) : (
              <div className="space-y-3">
                {filteredRoles.map((role) => {
                  const isTemplate = role.tenant_id === null;
                  const permissionKeys = role.permission_keys ?? [];
                  const visiblePermissions = permissionKeys.slice(0, 5);
                  const extraCount = Math.max(0, permissionKeys.length - visiblePermissions.length);

                  return (
                    <div key={role.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-semibold text-gray-900">{role.name}</div>
                            {isTemplate ? (
                              <Label theme="normal" size="s">
                                Шаблон
                              </Label>
                            ) : null}
                          </div>
                          <p className="text-sm text-gray-500">{role.service}</p>
                        </div>

                        <div className="flex gap-2">
                          {isTemplate ? (
                            <Button
                              view="outlined"
                              size="s"
                              onClick={() => handleRoleClone(role)}
                              disabled={!canManageRoles}
                            >
                              <Icon data={Plus} size={14} /> Создать копию
                            </Button>
                          ) : (
                            <Button
                              view="flat"
                              size="s"
                              onClick={() => handleRoleEdit(role)}
                              disabled={!canManageRoles}
                            >
                              Изменить
                            </Button>
                          )}

                          <Button
                            view="flat"
                            size="s"
                            disabled={Boolean(deletingRoleId) || !canManageRoles || isTemplate}
                            onClick={() => handleRoleDelete(role)}
                          >
                            {deletingRoleId === role.id ? 'Удаление…' : 'Удалить'}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {visiblePermissions.length === 0 ? (
                          <Label theme="normal" size="s">
                            Нет прав
                          </Label>
                        ) : (
                          visiblePermissions.map((permission) => (
                            <Label key={permission} theme="info" size="s">
                              {permission}
                            </Label>
                          ))
                        )}
                        {extraCount > 0 && (
                          <Label theme="normal" size="s">
                            +{extraCount}
                          </Label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {roleFormMode === 'edit'
                  ? 'Редактирование роли'
                  : roleFormMode === 'clone'
                    ? 'Новая роль из шаблона'
                    : 'Создание роли'}
              </h3>
              <p className="text-sm text-gray-500">
                {roleFormMode === 'clone' && roleTemplate
                  ? `Шаблон: ${roleTemplate.name}`
                  : 'Роль определяет набор доступных permission-ключей.'}
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">Сервис</div>
              <TextInput
                value={roleForm.service}
                onUpdate={(value) => setRoleForm((prev) => ({ ...prev, service: value }))}
                disabled={!canManageRoles}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">Имя роли</div>
              <TextInput
                value={roleForm.name}
                onUpdate={(value) => setRoleForm((prev) => ({ ...prev, name: value }))}
                disabled={!canManageRoles}
              />
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Права</p>
              <Select
                multiple
                filterable
                options={permissionOptions}
                value={normalizedPermissionKeys}
                onUpdate={(value) =>
                  setRoleForm((prev) => ({
                    ...prev,
                    permissionKeys: Array.isArray(value) ? value : [value],
                  }))
                }
                placeholder={loadingPermissions ? 'Загрузка…' : 'Выберите права'}
                disabled={loadingPermissions || !canManageRoles}
                width="max"
              />
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              {(roleFormMode === 'edit' || roleFormMode === 'clone') && (
                <Button view="flat" onClick={resetRoleForm} disabled={!canManageRoles}>
                  Отмена
                </Button>
              )}
              <Button view="action" loading={savingRole} onClick={handleRoleSubmit} disabled={!canManageRoles}>
                {roleFormMode === 'edit' ? 'Сохранить' : 'Создать роль'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'permissions' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Каталог прав</h2>
              <p className="text-sm text-gray-500">Используйте этот список при создании ролей.</p>
            </div>
          </div>

          {!canViewPermissions ? (
            <p className="text-sm text-gray-500">Нет доступа к каталогу прав.</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
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
                />
              </div>

              {loadingPermissions ? (
                <Loader size="l" />
              ) : permissionGroups.length === 0 ? (
                <p className="text-sm text-gray-500">Ничего не найдено.</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {permissionGroups.map((group) => (
                    <div key={group.service} className="border border-gray-200 rounded-lg p-4">
                      <div className="text-sm font-semibold text-gray-900 mb-2">{group.service}</div>
                      <div className="space-y-2">
                        {group.items.map((permission) => (
                          <div
                            key={permission.key}
                            className="flex items-start justify-between gap-3"
                          >
                            <div>
                              <div className="text-sm font-semibold text-gray-800">{permission.key}</div>
                              <div className="text-xs text-gray-500">{permission.description}</div>
                            </div>
                            <Label theme="normal" size="s">
                              {permission.service}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">История изменений</h2>
              <p className="text-sm text-gray-500">
                Последние действия администраторов в рамках тенанта.
              </p>
            </div>
            <Button view="flat" size="m" onClick={reloadEvents}>
              Обновить
            </Button>
          </div>

          <TextInput
            value={auditQuery}
            placeholder="Поиск по действию, пользователю или роли"
            onUpdate={(value) => setAuditQuery(value)}
            startContent={<Icon data={Magnifier} size={16} />}
          />

          {loadingEvents ? (
            <Loader size="m" />
          ) : filteredEvents.length === 0 ? (
            <p className="text-sm text-gray-500">Событий пока нет.</p>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((event) => (
                <div key={event.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{event.action}</span>
                    <span>{formatIsoDate(event.created_at)}</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 mt-1">{event.target_type}</div>
                  <div className="text-xs text-gray-500">Пользователь: {event.performed_by}</div>
                  {event.target_id ? (
                    <div className="text-xs text-gray-500">Target ID: {event.target_id}</div>
                  ) : null}
                  {event.metadata && Object.keys(event.metadata).length > 0 ? (
                    <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
