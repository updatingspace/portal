import { describe, expect, it } from 'vitest';
import { permissionLabel, presentAuditEvent, roleLabel, scopeLabel } from './presentation';
import type { TenantAdminEvent, TenantRole } from './api';

const role: TenantRole = { id: 34, name: 'owner', service: 'events', tenant_id: 'tenant-a', permission_keys: [] };
const event: TenantAdminEvent = {
  id: 'event-1', action: 'tenant_owner_provisioned', target_type: 'binding', target_id: '27',
  performed_by: 'reviewer', created_at: '2026-09-30T16:53:00Z', metadata: { user_id: 'owner', role_id: '34' },
};
const memberName = (id: string) => id === 'owner' ? 'Мария Иванова' : 'Алексей Петров';

describe('tenant administration descriptions', () => {
  it('explains the actual provisioning event using people and service names', () => {
    expect(presentAuditEvent(event, [role], memberName)).toEqual({
      title: 'Предоставлен доступ владельцу',
      description: 'Владелец: Мария Иванова. Раздел: События.',
      actor: 'Алексей Петров',
    });
  });
  it('preserves the historical role name and handles unavailable roles', () => {
    expect(presentAuditEvent({ ...event, action: 'role_deleted', metadata: { name: 'Организатор', service: 'events' } }, [], memberName).description)
      .toBe('Организатор · События');
    expect(presentAuditEvent({ ...event, action: 'binding_deleted' }, [], memberName).description)
      .toContain('Роль недоступна');
  });
  it('keeps custom role names and unknown permissions distinguishable', () => {
    expect(roleLabel('Организатор')).toBe('Организатор');
    expect(permissionLabel('portal.roles.write')).toBe('Создавать и изменять роли');
    expect(permissionLabel({ key: 'custom.export', description: 'Экспорт отчётов', service: 'custom' })).toBe('Экспорт отчётов');
    expect(scopeLabel('TENANT', 'tenant-b', 'tenant-a')).not.toBe('Всё сообщество');
  });
});
