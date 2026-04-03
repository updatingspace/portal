import React, { useMemo, useState } from 'react';
import { Button, Card, Label, Loader, Switch, TextInput } from '@gravity-ui/uikit';

import { useAuth } from '../../contexts/AuthContext';
import { StatusView } from '../../modules/portal/components/StatusView';
import { toaster } from '../../toaster';
import { notifyApiError } from '../../utils/apiErrorHandling';
import { useFeatureFlags } from '../../modules/featureFlags/hooks';

const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '_');

export const FeatureFlagsPage: React.FC = () => {
  const { user } = useAuth();
  const { flags, loading, create, patch } = useFeatureFlags();

  const [newKey, setNewKey] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const canManage = Boolean(user?.isSuperuser);
  const normalizedNewKey = useMemo(() => normalizeKey(newKey), [newKey]);

  if (!canManage) {
    return <StatusView kind="no-access" title="Недостаточно прав" description="Нужны права системного администратора" />;
  }

  const onCreate = async () => {
    if (!normalizedNewKey) {
      toaster.add({ name: 'feature-flags-empty-key', title: 'Введите ключ feature flag', theme: 'warning' });
      return;
    }

    setCreating(true);
    try {
      await create({
        key: normalizedNewKey,
        description: newDescription.trim(),
        enabled: false,
        rollout: 100,
      });
      setNewKey('');
      setNewDescription('');
      toaster.add({ name: 'feature-flags-created', title: 'Флаг создан', theme: 'success' });
    } catch (error) {
      notifyApiError(error, 'Не удалось создать флаг');
    } finally {
      setCreating(false);
    }
  };

  const onToggle = async (key: string, enabled: boolean) => {
    setSavingKey(key);
    try {
      await patch(key, { enabled });
    } catch (error) {
      notifyApiError(error, 'Не удалось обновить флаг');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="container py-4 d-flex flex-column gap-3">
      <div>
        <h2 className="mb-1">Feature Flags</h2>
        <p className="text-muted mb-0">Сетевые флаги платформы. Изменения применяются сразу.</p>
      </div>

      <Card view="outlined" className="p-3 d-flex flex-column gap-2">
        <Label theme="unknown">Создать новый флаг</Label>
        <div className="d-flex gap-2 flex-wrap">
          <TextInput
            value={newKey}
            onUpdate={setNewKey}
            placeholder="new_dashboard"
            size="l"
            className="flex-grow-1"
          />
          <TextInput
            value={newDescription}
            onUpdate={setNewDescription}
            placeholder="Описание"
            size="l"
            className="flex-grow-1"
          />
          <Button view="action" size="l" loading={creating} onClick={onCreate}>
            Создать
          </Button>
        </div>
      </Card>

      <Card view="outlined" className="p-3 d-flex flex-column gap-2">
        <Label theme="unknown">Текущие флаги</Label>
        {loading ? (
          <div className="py-4 d-flex justify-content-center">
            <Loader size="m" />
          </div>
        ) : null}

        {!loading && flags.length === 0 ? (
          <p className="text-muted mb-0">Флаги еще не созданы.</p>
        ) : null}

        {!loading && flags.length > 0
          ? flags.map((flag) => (
              <div
                key={flag.key}
                className="d-flex align-items-center justify-content-between border rounded p-2"
              >
                <div>
                  <div className="fw-semibold">{flag.key}</div>
                  <div className="text-muted small">{flag.description || 'Без описания'}</div>
                </div>
                <Switch
                  checked={flag.enabled}
                  disabled={savingKey === flag.key}
                  onUpdate={(next) => onToggle(flag.key, next)}
                  content={flag.enabled ? 'ON' : 'OFF'}
                />
              </div>
            ))
          : null}
      </Card>
    </div>
  );
};
