import { useState } from 'react';
import { Select } from '@gravity-ui/uikit';
import { useQuery } from '@tanstack/react-query';
import { request } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import {
  FormField,
  InlineError,
  useUITranslation,
} from '../../../shared/ui/portal/PortalUI';
import type { ScopeType } from '../api';
type NamedScope = { id: string; name: string };

export function ScopePicker({
  type,
  id,
  onChange,
  disabled,
}: {
  type: ScopeType;
  id: string;
  onChange: (type: ScopeType, id: string) => void;
  disabled?: boolean;
}) {
  const t = useUITranslation();
  const { user } = useAuth();
  const tenant = user?.tenant?.id ?? '';
  const [group, setGroup] = useState('');
  const groups = useQuery({
    queryKey: ['scope-options', tenant, user?.id, 'groups'],
    queryFn: () => request<NamedScope[]>('/portal/communities'),
    enabled: type === 'COMMUNITY' || type === 'TEAM',
  });
  const teams = useQuery({
    queryKey: ['scope-options', tenant, user?.id, 'teams', group],
    queryFn: () =>
      request<NamedScope[]>(
        `/portal/teams?community_id=${encodeURIComponent(group)}`,
      ),
    enabled: type === 'TEAM' && Boolean(group),
  });
  return (
    <div className="portal-stack">
      <FormField label={t('Где действует роль', 'Role applies to')}>
        {(props) => (
          <Select
            {...props}
            size="xl"
            width="max"
            disabled={disabled}
            value={[type]}
            options={[
              {
                value: 'TENANT',
                content: t('Всё сообщество', 'Entire community'),
              },
              { value: 'COMMUNITY', content: t('Группа', 'Group') },
              { value: 'TEAM', content: t('Команда', 'Team') },
            ]}
            onUpdate={(values) => {
              const next = values[0] as ScopeType;
              setGroup('');
              onChange(next, next === 'TENANT' ? tenant : '');
            }}
          />
        )}
      </FormField>
      {type === 'TENANT' && (
        <p className="tenant-admin__member-meta">{user?.tenant?.slug}</p>
      )}
      {(type === 'COMMUNITY' || type === 'TEAM') && (
        <FormField label={t('Группа', 'Group')}>
          {(props) => (
            <Select
              {...props}
              size="xl"
              width="max"
              filterable
              disabled={disabled || groups.isLoading}
              placeholder={t('Выберите группу', 'Choose a group')}
              options={(groups.data ?? []).map((item) => ({
                value: item.id,
                content: item.name,
              }))}
              value={
                type === 'COMMUNITY' ? (id ? [id] : []) : group ? [group] : []
              }
              onUpdate={(values) => {
                setGroup(values[0] ?? '');
                onChange(type, type === 'COMMUNITY' ? (values[0] ?? '') : '');
              }}
            />
          )}
        </FormField>
      )}
      {groups.isError && type !== 'TENANT' && (
        <InlineError onRetry={() => void groups.refetch()}>
          {t('Не удалось загрузить группы.', 'Unable to load groups.')}
        </InlineError>
      )}
      {type === 'TEAM' && group && (
        <FormField label={t('Команда', 'Team')}>
          {(props) => (
            <Select
              {...props}
              size="xl"
              width="max"
              filterable
              disabled={disabled || teams.isLoading}
              placeholder={t('Выберите команду', 'Choose a team')}
              options={(teams.data ?? []).map((item) => ({
                value: item.id,
                content: item.name,
              }))}
              value={id ? [id] : []}
              onUpdate={(values) => onChange('TEAM', values[0] ?? '')}
            />
          )}
        </FormField>
      )}
      {teams.isError && type === 'TEAM' && (
        <InlineError onRetry={() => void teams.refetch()}>
          {t('Не удалось загрузить команды.', 'Unable to load teams.')}
        </InlineError>
      )}
    </div>
  );
}
