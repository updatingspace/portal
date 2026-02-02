import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppLayout } from '../widgets/app-shell/AppLayout';
import { RequireSession } from './guards/RequireSession';
import { PublicLayout } from './layout/PublicLayout';

const LandingPage = lazy(() => import('../pages/landing/Page').then((mod) => ({ default: mod.LandingPage })));
const LoginPage = lazy(() => import('../pages/login/Page').then((mod) => ({ default: mod.LoginPage })));
const InvitePage = lazy(() => import('../pages/invite/Page').then((mod) => ({ default: mod.InvitePage })));
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
const SettingsPage = lazy(() => import('../pages/app/settings/Page').then((mod) => ({ default: mod.SettingsPage })));
const AdminPage = lazy(() => import('../pages/app/AdminPage').then((mod) => ({ default: mod.AdminPage })));
const TenantAdminPage = lazy(() => import('../pages/app/TenantAdminPage').then((mod) => ({ default: mod.TenantAdminPage })));
const PlaceholderPage = lazy(() => import('../pages/app/PlaceholderPage').then((mod) => ({ default: mod.PlaceholderPage })));
const PollCreatePage = lazy(() => import('../modules/voting/pages/PollCreatePage').then((mod) => ({ default: mod.PollCreatePage })));
const PollManagePage = lazy(() => import('../modules/voting/pages/PollManagePage').then((mod) => ({ default: mod.PollManagePage })));
const PollResultsPage = lazy(() => import('../modules/voting/pages/PollResultsPage').then((mod) => ({ default: mod.PollResultsPage })));
const PollTemplatesPage = lazy(() => import('../modules/voting/pages/PollTemplatesPage').then((mod) => ({ default: mod.PollTemplatesPage })));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then((mod) => ({ default: mod.NotFoundPage })));

const routeConfig = [
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/invite/:token', element: <InvitePage /> },
    ],
  },
  {
    element: <RequireSession />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/app', element: <DashboardPage /> },
          { path: '/app/feed', element: <FeedPage /> },
          { path: '/app/events', element: <EventsPage /> },
          { path: '/app/events/create', element: <CreateEventPage /> },
          { path: '/app/events/:id', element: <EventPage /> },
          { path: '/app/events/:id/edit', element: <EditEventPage /> },
          { path: '/app/communities', element: <PlaceholderPage title="Communities" /> },
          { path: '/app/teams', element: <PlaceholderPage title="Teams" /> },
          { path: '/app/voting', element: <VotingPage /> },
          { path: '/app/voting/create', element: <PollCreatePage /> },
          { path: '/app/voting/templates', element: <PollTemplatesPage /> },
          { path: '/app/voting/analytics', element: <VotingAnalyticsPage /> },
          { path: '/app/voting/:id', element: <VotingCampaignPage /> },
          { path: '/app/voting/:id/manage', element: <PollManagePage /> },
          { path: '/app/voting/:id/results', element: <PollResultsPage /> },
          { path: '/app/profile', element: <ProfilePage /> },
          { path: '/app/settings', element: <SettingsPage /> },
          { path: '/app/admin', element: <AdminPage /> },
          { path: '/app/tenant-admin', element: <TenantAdminPage /> },
        ],
      },
    ],
  },
  { path: '/feed', element: <Navigate to="/app/feed" replace /> },
  { path: '/events', element: <Navigate to="/app/events" replace /> },
  { path: '/events/:id', element: <Navigate to="/app/events/:id" replace /> },
  { path: '/voting', element: <Navigate to="/app/voting" replace /> },
  { path: '/voting/:id', element: <Navigate to="/app/voting/:id" replace /> },
  { path: '/me', element: <Navigate to="/app/profile" replace /> },
  { path: '/profile', element: <Navigate to="/app/profile" replace /> },
  { path: '/admin', element: <Navigate to="/app/admin" replace /> },
  { path: '/admin/applications', element: <Navigate to="/app/admin" replace /> },
  { path: '/nominations', element: <Navigate to="/app/voting" replace /> },
  { path: '/nominations/:id', element: <Navigate to="/app/voting/:id" replace /> },
  { path: '/votings/:votingId', element: <Navigate to="/app/voting/:votingId" replace /> },
  { path: '*', element: <NotFoundPage /> },
];

export const createAppRouter = () => createBrowserRouter(routeConfig);
