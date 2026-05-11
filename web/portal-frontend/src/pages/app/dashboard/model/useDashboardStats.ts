import { useMemo } from 'react';
import { usePortalI18n } from '../../../../shared/i18n/usePortalI18n';

export type DashboardStat = {
  title: string;
  value: string;
  description: string;
};

export const useDashboardStats = () => {
  const { t } = usePortalI18n();
  const stats = useMemo<DashboardStat[]>(
    () => [
      { title: t('dashboard.stats.activePolls.title'), value: '8', description: t('dashboard.stats.activePolls.description') },
      { title: t('dashboard.stats.upcomingEvents.title'), value: '12', description: t('dashboard.stats.upcomingEvents.description') },
      { title: t('dashboard.stats.recentActivity.title'), value: '156', description: t('dashboard.stats.recentActivity.description') },
    ],
    [t],
  );

  return {
    stats,
    isLoading: false,
  };
};
