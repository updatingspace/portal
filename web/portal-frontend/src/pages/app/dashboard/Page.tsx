import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { DashboardCard } from './ui/DashboardCard';
import { DashboardCardSkeleton } from './ui/DashboardCardSkeleton';
import { DashboardHero } from './ui/DashboardHero';
import { DashboardHeroSkeleton } from './ui/DashboardHeroSkeleton';
import { useDashboardStats } from './model/useDashboardStats';
import { useRouteBase } from '../../../shared/hooks/useRouteBase';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { stats, isLoading } = useDashboardStats();
  const routeBase = useRouteBase();

  const handleOpenFeed = useCallback(() => navigate(`${routeBase}/feed`), [navigate, routeBase]);
  const handleOpenEvents = useCallback(() => navigate(`${routeBase}/events`), [navigate, routeBase]);
  const handleOpenVoting = useCallback(() => navigate(`${routeBase}/voting`), [navigate, routeBase]);

  return (
    <div className="container-fluid" style={{ maxWidth: 1100 }}>
      <div className="text-muted small">Overview</div>
      <h1 className="h3 fw-semibold mb-4">Dashboard</h1>

      {isLoading ? (
        <DashboardHeroSkeleton />
      ) : (
        <DashboardHero
          onOpenFeed={handleOpenFeed}
          onOpenEvents={handleOpenEvents}
          onOpenVoting={handleOpenVoting}
        />
      )}

      <section className="row g-3">
        {stats.map((stat) => (
          <div key={stat.title} className="col-12 col-md-6 col-xl-4">
            {isLoading ? <DashboardCardSkeleton /> : <DashboardCard stat={stat} />}
          </div>
        ))}
      </section>
    </div>
  );
};
