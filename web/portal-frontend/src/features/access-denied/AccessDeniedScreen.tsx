import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { AccessDeniedError, type AccessDeniedTenant } from '../../api/accessDenied';
import { useAuth } from '../../contexts/AuthContext';
import { env } from '../../shared/config/env';
import { getTenantFromHost } from '../../shared/lib/tenant';
import { toaster } from '../../toaster';
import { AccessDeniedView } from './AccessDeniedView';
import './access-denied.css';

type AccessDeniedScreenProps = {
  error?: AccessDeniedError;
  tenant?: AccessDeniedTenant | null;
};

const resolveTenantFromApp = (
  userTenant?: { id?: string | null; slug?: string | null },
): AccessDeniedTenant | null => {
  if (userTenant?.id || userTenant?.slug) {
    return {
      id: userTenant.id ?? null,
      slug: userTenant.slug ?? null,
    };
  }

  if (typeof window === 'undefined') return null;

  const hostTenant = getTenantFromHost(window.location.host, env.tenantHint);
  if (!hostTenant) return null;

  return {
    slug: hostTenant.slug,
  };
};

export const AccessDeniedScreen: React.FC<AccessDeniedScreenProps> = ({
  error,
  tenant,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const routeHasHistory = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.history.length > 1 && location.key !== 'default';
  }, [location.key]);

  const resolvedTenant = tenant ?? error?.tenant ?? resolveTenantFromApp(user?.tenant) ?? null;
  const reasonSummary = useMemo(() => {
    const raw = error?.reason?.trim();
    if (!raw) return null;
    const normalized = raw.replace(/\s+/g, ' ').trim();
    if (!normalized) return null;
    if (normalized === 'Ой... мы и сами в шоке, но у вашего аккаунта нет прав на этот раздел.') {
      return null;
    }
    const hasDebugMarkers = /(traceback|stack|exception|error:| at\s+\S+\(|\{.+:.+\})/i.test(normalized);
    if (hasDebugMarkers) {
      return null;
    }
    return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
  }, [error?.reason]);
  const pageTitleOrRoute = useMemo(() => {
    if (typeof document !== 'undefined') {
      const title = document.title?.trim();
      if (title) return title;
    }
    return location.pathname;
  }, [location.pathname]);

  const copyText = async (value: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (typeof window !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = value;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toaster.add({
        name: `copy-${Date.now()}`,
        title: 'Скопировано',
        theme: 'success',
      });
    } catch {
      toaster.add({
        name: `copy-failed-${Date.now()}`,
        title: 'Не удалось скопировать',
        theme: 'warning',
      });
    }
  };

  const handleCopyAdminMessage = () => {
    const requestId = error?.requestId ?? 'не передан';
    const message = [
      `Здравствуйте! У меня нет доступа к разделу: ${pageTitleOrRoute}.`,
      "Пожалуйста, проверьте права в tenant'е и выдайте доступ.",
      `Request ID: ${requestId}`,
    ].join('\n');
    void copyText(message);
  };

  const handleCopyRequestId = () => {
    if (!error?.requestId) return;
    void copyText(error.requestId);
  };

  return (
    <AccessDeniedView
      tenant={resolvedTenant}
      requestId={error?.requestId ?? null}
      service={error?.service ?? null}
      reasonSummary={reasonSummary}
      showBackAction={routeHasHistory}
      onHome={() => navigate('/app')}
      onBack={() => navigate(-1)}
      onCopyAdminMessage={handleCopyAdminMessage}
      onCopyRequestId={error?.requestId ? handleCopyRequestId : undefined}
    />
  );
};
