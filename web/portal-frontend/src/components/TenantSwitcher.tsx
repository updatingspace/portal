/**
 * TenantSwitcher — dropdown for switching between tenants in the app shell.
 *
 * Shows current tenant and allows switching to another.
 */
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useTenantContext } from '../contexts/TenantContext';
import type { TenantSummary } from '../api/tenant';

export const TenantSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const { activeTenant, availableTenants, doSwitchTenant } = useTenantContext();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const handleSelect = useCallback(
    async (tenant: TenantSummary) => {
      if (tenant.tenant_slug === activeTenant?.tenant_slug) {
        setIsOpen(false);
        return;
      }
      setSwitching(true);
      const success = await doSwitchTenant(tenant.tenant_slug);
      setSwitching(false);
      setIsOpen(false);
      if (success) {
        navigate(`/t/${tenant.tenant_slug}/`, { replace: true });
      }
    },
    [activeTenant, doSwitchTenant, navigate],
  );

  if (!activeTenant || availableTenants.length <= 1) {
    // Show current tenant name but no dropdown if only 1 tenant
    if (activeTenant) {
      return (
        <span
          style={{
            fontWeight: 600,
            fontSize: '0.9rem',
            padding: '0.25rem 0.5rem',
          }}
        >
          {activeTenant.display_name}
        </span>
      );
    }
    return null;
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        style={{
          fontWeight: 600,
          fontSize: '0.9rem',
          padding: '0.25rem 0.75rem',
          cursor: 'pointer',
          borderRadius: 6,
          border: '1px solid #ddd',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
      >
        {switching ? '...' : activeTenant.display_name}
        <span style={{ fontSize: '0.7rem' }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '0.25rem',
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 999,
            minWidth: 200,
            overflow: 'hidden',
          }}
        >
          {availableTenants.map((t) => (
            <div
              key={t.tenant_id}
              onClick={() => handleSelect(t)}
              onKeyDown={(e) => e.key === 'Enter' && handleSelect(t)}
              role="button"
              tabIndex={0}
              style={{
                padding: '0.625rem 1rem',
                cursor: 'pointer',
                background: t.tenant_slug === activeTenant.tenant_slug ? '#f0f4ff' : 'transparent',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{t.display_name}</div>
                <div style={{ color: '#888', fontSize: '0.8rem' }}>/{t.tenant_slug}</div>
              </div>
              {t.tenant_slug === activeTenant.tenant_slug && (
                <span style={{ color: '#4a90d9', fontSize: '0.85rem' }}>✓</span>
              )}
            </div>
          ))}

          <div
            onClick={() => {
              setIsOpen(false);
              navigate('/choose-tenant');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setIsOpen(false);
                navigate('/choose-tenant');
              }
            }}
            role="button"
            tabIndex={0}
            style={{
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              color: '#4a90d9',
              fontSize: '0.85rem',
              borderTop: '1px solid #e0e0e0',
            }}
          >
            Все сообщества →
          </div>
        </div>
      )}
    </div>
  );
};
