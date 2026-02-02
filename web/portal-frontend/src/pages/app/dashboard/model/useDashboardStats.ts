import { useMemo } from 'react';

export type DashboardStat = {
  title: string;
  value: string;
  description: string;
};

export const useDashboardStats = () => {
  const stats = useMemo<DashboardStat[]>(
    () => [
      { title: 'Active polls', value: '8', description: 'Voting campaigns running now across teams' },
      { title: 'Upcoming events', value: '12', description: 'Scheduled events that need attention' },
      { title: 'Recent activity', value: '156', description: 'Feed items generated in the last 24 hours' },
    ],
    [],
  );

  return {
    stats,
    isLoading: false,
  };
};
