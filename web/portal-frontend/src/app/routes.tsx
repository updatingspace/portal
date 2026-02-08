/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react';
import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';

import { AppLayout } from '../widgets/app-shell/AppLayout';
import { RequireCapability } from './guards/RequireCapability';
import { RequireSession } from './guards/RequireSession';
import { TenantGate } from './guards/TenantGate';
import { PublicLayout } from './layout/PublicLayout';

const LandingPage = lazy(() => import('../pages/landing/Page').then((mod) => ({ default: mod.LandingPage })));
const LoginPage = lazy(() => import('../pages/login/Page').then((mod) => ({ default: mod.LoginPage })));
const InvitePage = lazy(() => import('../pages/invite/Page').then((mod) => ({ default: mod.InvitePage })));
const TenantChooserPage = lazy(() => import('../pages/tenant/TenantChooserPage').then((mod) => ({ default: mod.TenantChooserPage })));
const DashboardPage = lazy(() => import('../pages/app/dashboard/Page').then((mod) => ({ default: mod.DashboardPage })));
const FeedPage = lazy(() => import('../pages/app/FeedPage').then((mod) => ({ default: mod.FeedPage })));
const EventsPage = lazy(() => import('../modules/events/pages/EventsPage').then((mod) => ({ default: mod.EventsPage })));
const CreateEventPage = lazy(() => import('../modules/events/pages/CreateEventPage').then((mod) => ({ default: mod.CreateEventPage })));
const EventPage = lazy(() => import('../modules/events/pages/EventPage').then((mod) => ({ default: mod.EventPage })));
const EditEventPage = lazy(() => import('../modules/events/pages/EditEventPage').then((mod) => ({ default: mod.EditEventPage })));
const VotingPage = lazy(() => import('../pages/app/VotingPages').then((mod) => ({ default: mod.VotingPage })));
const VotingCampaignPage = lazy(() => import('../pages/app/VotingPages').then((mod) => ({ default: mod.VotingCampaignPage })));
const VotingAnalyticsPage = lazy(() => import('../pages/app/VotingPages').then((mod) => ({ default: mod.VotingAnalyticsPage })));
const ProfilePage = lazy(() => import('../pages/app/profile/Page').then((mod) => ({ default: mod.ProfilePage })));
const UserProfilePage = lazy(() =>
  import('../pages/app/profile/UserProfilePage').then((mod) => ({ default: mod.UserProfilePage })),
);
const FollowingListPage = lazy(() =>
  import('../pages/app/profile/components/list-pages/FollowingListPage').then((mod) => ({ default: mod.FollowingListPage })),
);
const FollowersListPage = lazy(() =>
  import('../pages/app/profile/components/list-pages/FollowersListPage').then((mod) => ({ default: mod.FollowersListPage })),
);
const CommunitiesListPage = lazy(() =>
  import('../pages/app/profile/components/list-pages/CommunitiesListPage').then((mod) => ({ default: mod.CommunitiesListPage })),
);
const AchievementsListPage = lazy(() =>
  import('../pages/app/profile/components/list-pages/AchievementsListPage').then((mod) => ({ default: mod.AchievementsListPage })),
);
const FriendsListPage = lazy(() =>
  import('../pages/app/profile/components/list-pages/FriendsListPage').then((mod) => ({ default: mod.FriendsListPage })),
);
const SettingsPage = lazy(() => import('../pages/app/settings/Page').then((mod) => ({ default: mod.SettingsPage })));
const AdminPage = lazy(() => import('../pages/app/AdminPage').then((mod) => ({ default: mod.AdminPage })));
const TenantAdminPage = lazy(() => import('../pages/app/TenantAdminPage').then((mod) => ({ default: mod.TenantAdminPage })));
const PlaceholderPage = lazy(() => import('../pages/app/PlaceholderPage').then((mod) => ({ default: mod.PlaceholderPage })));
const PollCreatePage = lazy(() => import('../modules/voting/pages/PollCreatePage').then((mod) => ({ default: mod.PollCreatePage })));
const PollManagePage = lazy(() => import('../modules/voting/pages/PollManagePage').then((mod) => ({ default: mod.PollManagePage })));
const PollResultsPage = lazy(() => import('../modules/voting/pages/PollResultsPage').then((mod) => ({ default: mod.PollResultsPage })));
const PollTemplatesPage = lazy(() => import('../modules/voting/pages/PollTemplatesPage').then((mod) => ({ default: mod.PollTemplatesPage })));
const GamificationDashboardPage = lazy(() =>
  import('../modules/gamification/pages/GamificationDashboardPage').then((mod) => ({ default: mod.GamificationDashboardPage })),
);
const AchievementFormPage = lazy(() =>
  import('../modules/gamification/pages/AchievementFormPage').then((mod) => ({ default: mod.AchievementFormPage })),
);
const AchievementDetailPage = lazy(() =>
  import('../modules/gamification/pages/AchievementDetailPage').then((mod) => ({ default: mod.AchievementDetailPage })),
);
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then((mod) => ({ default: mod.NotFoundPage })));

const LegacyVotingRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/choose-tenant` : '/choose-tenant'} replace />;
};

/**
 * Redirect /app/* → /choose-tenant.
 * Active tenant will be picked there (or auto-routed to /t/:slug/).
 */
const LegacyAppRedirect = () => {
  return <Navigate to="/choose-tenant" replace />;
};

/**
 * Shared app routes used both under /app/* (legacy) and /t/:tenantSlug/* (new).
 * Extracted to avoid duplication.
 */
const appChildRoutes = [
  { index: true, element: <DashboardPage /> },
  {
    path: 'feed',
    element: (
      <RequireCapability required="activity.feed.read">
        <FeedPage />
      </RequireCapability>
    ),
  },
  {
    path: 'events',
    element: (
      <RequireCapability required={['events.event.read', 'events.event.create']} mode="any">
        <EventsPage />
      </RequireCapability>
    ),
  },
  { path: 'events/create', element: <CreateEventPage /> },
  { path: 'events/:id', element: <EventPage /> },
  { path: 'events/:id/edit', element: <EditEventPage /> },
  { path: 'communities', element: <PlaceholderPage title="Communities" /> },
  { path: 'teams', element: <PlaceholderPage title="Teams" /> },
  { path: 'voting', element: <VotingPage /> },
  { path: 'voting/create', element: <PollCreatePage /> },
  { path: 'voting/templates', element: <PollTemplatesPage /> },
  { path: 'voting/analytics', element: <VotingAnalyticsPage /> },
  { path: 'voting/:id', element: <VotingCampaignPage /> },
  { path: 'voting/:id/manage', element: <PollManagePage /> },
  { path: 'voting/:id/results', element: <PollResultsPage /> },
  { path: 'profile/user/:username', element: <UserProfilePage /> },
  { path: 'profile', element: <ProfilePage /> },
  { path: 'profile/following', element: <FollowingListPage /> },
  { path: 'profile/followers', element: <FollowersListPage /> },
  { path: 'profile/communities', element: <CommunitiesListPage /> },
  { path: 'profile/achievements', element: <AchievementsListPage /> },
  { path: 'profile/friends', element: <FriendsListPage /> },
  { path: 'settings', element: <SettingsPage /> },
  { path: 'admin', element: <AdminPage /> },
  {
    path: 'tenant-admin',
    element: (
      <RequireCapability required="portal.roles.read">
        <TenantAdminPage />
      </RequireCapability>
    ),
  },
  { path: 'gamification', element: <GamificationDashboardPage /> },
  { path: 'gamification/achievements/new', element: <AchievementFormPage /> },
  { path: 'gamification/achievements/:id/edit', element: <AchievementFormPage /> },
  { path: 'gamification/achievements/:id', element: <AchievementDetailPage /> },
];

const routeConfig = [
  // Public routes (no tenant, no auth)
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/invite/:token', element: <InvitePage /> },
    ],
  },
  // Tenant chooser (auth required, tenantless)
  {
    element: <RequireSession />,
    children: [
      { path: '/choose-tenant', element: <TenantChooserPage /> },
    ],
  },
  // Path-based tenant routes: /t/:tenantSlug/*
  {
    element: <RequireSession />,
    children: [
      {
        path: '/t/:tenantSlug',
        element: <TenantGate />,
        children: [
          {
            element: <AppLayout />,
            children: appChildRoutes,
          },
        ],
      },
    ],
  },
  // Legacy /app/* routes → redirect to tenant chooser
  { path: '/app/*', element: <LegacyAppRedirect /> },
  { path: '/app', element: <LegacyAppRedirect /> },
  // Legacy redirects → tenant chooser
  { path: '/feed', element: <Navigate to="/choose-tenant" replace /> },
  { path: '/events', element: <Navigate to="/choose-tenant" replace /> },
  { path: '/events/:id', element: <Navigate to="/choose-tenant" replace /> },
  { path: '/voting', element: <Navigate to="/choose-tenant" replace /> },
  { path: '/voting/:id', element: <LegacyVotingRedirect /> },
  { path: '/me', element: <Navigate to="/choose-tenant" replace /> },
  { path: '/profile', element: <Navigate to="/choose-tenant" replace /> },
  { path: '/admin', element: <Navigate to="/choose-tenant" replace /> },
  { path: '/admin/applications', element: <Navigate to="/choose-tenant" replace /> },
  { path: '*', element: <NotFoundPage /> },
];

export const createAppRouter = () => createBrowserRouter(routeConfig);
