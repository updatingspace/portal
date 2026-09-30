import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { LegacyRedirect } from './LegacyRedirect';
import { LegacyAppRedirect } from './guards/LegacyAppRedirect';
import { FeatureGate } from './guards/FeatureGate';
import {RouteErrorState} from './RouteErrorState';
import { AppLayout } from '../widgets/app-shell/AppLayout';
import { RequireCapability } from './guards/RequireCapability';
import { RequireSession } from './guards/RequireSession';
import { TenantGate } from './guards/TenantGate';
import { PublicLayout } from './layout/PublicLayout';
import { TenantChooserPage } from '../pages/tenant/TenantChooserPage';

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


const CommunitiesListPage = lazy(() =>
  import('../pages/app/profile/components/list-pages/CommunitiesListPage').then((mod) => ({ default: mod.CommunitiesListPage })),
);
const AchievementsListPage = lazy(() =>
  import('../pages/app/profile/components/list-pages/AchievementsListPage').then((mod) => ({ default: mod.AchievementsListPage })),
);

const SettingsPage = lazy(() => import('../pages/app/settings/Page').then((mod) => ({ default: mod.SettingsPage })));
const AdminPage = lazy(() => import('../pages/app/AdminPage').then((mod) => ({ default: mod.AdminPage })));
const TenantAdminPage = lazy(() => import('../pages/app/TenantAdminPage').then((mod) => ({ default: mod.TenantAdminPage })));
const FeatureFlagsPage = lazy(() => import('../pages/app/FeatureFlagsPage').then((mod) => ({ default: mod.FeatureFlagsPage })));
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

const inAppRouteSpecs = [
  { path: '', element: <DashboardPage />, title: 'Overview' },
  {
    path: 'feed',
    element: (
      <RequireCapability required="activity.feed.read">
        <FeedPage />
      </RequireCapability>
    ),
    title: 'Лента',
  },
  {
    path: 'feed/:newsId',
    element: (
      <RequireCapability required="activity.feed.read">
        <FeedPage />
      </RequireCapability>
    ),
    title: 'Новость',
  },
  {
    path: 'events',
    element: (
      <RequireCapability required={['events.event.read', 'events.event.create']} mode="any">
        <EventsPage />
      </RequireCapability>
    ),
    title: 'События',
  },
  { path: 'events/create', element: <RequireCapability required="events.event.create"><CreateEventPage /></RequireCapability>, title: 'Создание события' },
  { path: 'events/:id', element: <EventPage />, title: 'Событие' },
  { path: 'events/:id/edit', element: <RequireCapability required="events.event.manage"><EditEventPage /></RequireCapability>, title: 'Редактирование события' },
  { path: 'communities', element: <PlaceholderPage title="Группы сообщества" />, title: 'Communities' },
  { path: 'teams', element: <PlaceholderPage title="Команды" />, title: 'Teams' },
  { path: 'voting', element: <VotingPage />, title: 'Опросы' },
  { path: 'voting/create', element: <PollCreatePage />, title: 'Создание опроса' },
  { path: 'voting/templates', element: <PollTemplatesPage />, title: 'Шаблоны опросов' },
  { path: 'voting/analytics', element: <VotingAnalyticsPage />, title: 'Аналитика голосований' },
  { path: 'voting/:id', element: <VotingCampaignPage />, title: 'Опрос' },
  { path: 'voting/:id/manage', element: <PollManagePage />, title: 'Управление опросом' },
  { path: 'voting/:id/results', element: <PollResultsPage />, title: 'Результаты опроса' },
  { path: 'profile', element: <ProfilePage />, title: 'Профиль' },
  { path: 'profile/following', element: <PlaceholderPage title="Подписки" />, title: 'Подписки' },
  { path: 'profile/followers', element: <PlaceholderPage title="Подписчики" />, title: 'Подписчики' },
  { path: 'profile/communities', element: <CommunitiesListPage />, title: 'Сообщества' },
  { path: 'profile/achievements', element: <AchievementsListPage />, title: 'Ачивки' },
  { path: 'profile/friends', element: <PlaceholderPage title="Друзья" />, title: 'Друзья' },
  { path: 'settings', element: <SettingsPage />, title: 'Настройки' },
  { path: 'admin', element: <AdminPage />, title: 'Администрирование' },
  {
    path: 'tenant-admin',
    element: (
      <RequireCapability required="portal.roles.read">
        <TenantAdminPage />
      </RequireCapability>
    ),
    title: 'Управление сообществом',
  },
  { path: 'feature-flags', element: <FeatureFlagsPage />, title: 'Функции платформы' },
  { path: 'gamification', element: <GamificationDashboardPage />, title: 'Геймификация' },
  { path: 'gamification/achievements/new', element: <AchievementFormPage />, title: 'Новая ачивка' },
  { path: 'gamification/achievements/:id/edit', element: <AchievementFormPage />, title: 'Редактирование ачивки' },
  { path: 'gamification/achievements/:id', element: <AchievementDetailPage />, title: 'Карточка ачивки' },
];

const createLegacyInAppRoutes = () =>
  inAppRouteSpecs.map(({ path, element, title }) =>
    path
      ? { path: `/app/${path}`, element, handle: { title } }
      : { path: '/app', element, handle: { title } },
  );

const createTenantInAppRoutes = () =>
  inAppRouteSpecs.map(({ path, element, title }) =>
    path ? { path, element: path.startsWith('voting') ? <FeatureGate>{element}</FeatureGate> : element, handle: { title } } : { index: true, element, handle: { title } },
  );

const routeConfig = [
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <LandingPage />, handle: { title: 'Главная' } },
      { path: '/login', element: <LoginPage />, handle: { title: 'Вход' } },
      { path: '/invite/:token', element: <InvitePage />, handle: { title: 'Активация приглашения' } },
    ],
  },
  {
    element: <RequireSession />,
    children: [
      { path: '/choose-tenant', element: <TenantChooserPage />, handle: { title: 'Выбор сообщества' } },
      {
        element: <LegacyAppRedirect />,
        children: createLegacyInAppRoutes(),
      },
      {
        path: '/t/:tenantSlug',
        element: <TenantGate />,
        children: [
          {
            element: <AppLayout />,
            children: createTenantInAppRoutes(),
          },
        ],
      },
    ],
  },
  { path: '/feed', element: <LegacyRedirect to="/app/feed" /> },
  { path: '/events', element: <LegacyRedirect to="/app/events" /> },
  { path: '/events/:id', element: <LegacyRedirect to="/app/events/:id" /> },
  { path: '/voting', element: <LegacyRedirect to="/app/voting" /> },
  { path: '/voting/:id', element: <LegacyRedirect to="/app/voting/:id" /> },
  { path: '/me', element: <LegacyRedirect to="/app/profile" /> },
  { path: '/profile', element: <LegacyRedirect to="/app/profile" /> },
  { path: '/admin', element: <LegacyRedirect to="/app/admin" /> },
  { path: '/admin/applications', element: <LegacyRedirect to="/app/admin" /> },
  { path: '/nominations', element: <LegacyRedirect to="/app/voting" /> },
  { path: '/nominations/:id', element: <LegacyRedirect to="/app/voting/:id" /> },
  { path: '/votings/:votingId', element: <LegacyRedirect to="/app/voting/:votingId" /> },
  { path: '*', element: <NotFoundPage /> },
];

export const createAppRouter = () => createBrowserRouter(routeConfig.map(route=>({...route,errorElement:<RouteErrorState/>})));
