import type {MenuItem} from '@gravity-ui/navigation';

import House from '@gravity-ui/icons/House';
import Pulse from '@gravity-ui/icons/Pulse';
import Calendar from '@gravity-ui/icons/Calendar';
import ListCheck from '@gravity-ui/icons/ListCheck';
import Shield from '@gravity-ui/icons/Shield';
import Gear from '@gravity-ui/icons/Gear';

import type {UserInfo} from '../../contexts/AuthContext';
import {can} from '../rbac/can';
import { portalMessages } from '../../shared/i18n/messages';
import { normalizeLocale, type Locale } from '../../shared/lib/locale';

export type NavItemConfig = {
  id: string;
  title: string;
  description?: string;
  route: string;
  icon?: MenuItem['icon'];
  required?: string | string[];
  badge?: string;
};

const BASE_ITEMS: NavItemConfig[] = [
  {id: 'dashboard', title: 'Dashboard', description: 'Overview', route: '/app', icon: House},
  {id: 'feed', title: 'Activity Feed', description: 'Updates and logs', route: '/app/feed', icon: Pulse, required: 'activity.feed.read'},
  {id: 'events', title: 'Events', description: 'Community events', route: '/app/events', icon: Calendar, required: 'events.event.read'},
  {id: 'voting', title: 'Voting', description: 'Campaigns and nominations', route: '/app/voting', icon: ListCheck, required: 'voting.poll.read'},
  {id: 'gamification', title: 'Gamification', description: 'Achievements and grants', route: '/app/gamification', icon: ListCheck, required: 'gamification.achievements.read'},
  {id: 'tenant-admin', title: 'Tenant Admin', description: 'Roles, rights, access', route: '/app/tenant-admin', icon: Shield, required: 'portal.roles.read'},
];

function makeTooltip(title: string, description?: string) {
  return description ? `${title}\n${description}` : title;
}

type NavigationClickEvent = {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  button?: number;
  preventDefault?: () => void;
};

const isModifiedClick = (event: NavigationClickEvent): boolean =>
  Boolean(event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1);

const preventDefaultIfPossible = (event: NavigationClickEvent) => {
  if (typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
};

export const buildAsideMenuItems = (params: {
  user: UserInfo | null;
  locale?: Locale;
  currentPath: string;
  onNavigate: (to: string) => void;
  routeBase?: string;
}): MenuItem[] => {
  const {user, locale: inputLocale, currentPath, onNavigate, routeBase = '/app'} = params;
  const locale = normalizeLocale(inputLocale ?? user?.language ?? null);
  const messages = portalMessages[locale];

  const resolveRoute = (route: string) =>
    route.startsWith('/app') ? route.replace(/^\/app\b/, routeBase) : route;

  const visible = (item: NavItemConfig) => {
    if (!user?.capabilities?.length && !user?.roles?.length) {
      return item.id !== 'admin';
    }
    return can(user, item.required);
  };

  const localizedConfig = (item: NavItemConfig): NavItemConfig => {
    const keyMap: Record<string, keyof typeof messages.navigation> = {
      dashboard: 'dashboard',
      feed: 'feed',
      events: 'events',
      voting: 'voting',
      gamification: 'gamification',
      'tenant-admin': 'tenantAdmin',
    };
    const key = keyMap[item.id];
    if (!key) {
      return item;
    }
    return {
      ...item,
      title: messages.navigation[key].title,
      description: messages.navigation[key].description,
    };
  };

  const toMenuItem = (item: NavItemConfig): MenuItem => ({
    id: item.id,
    title: item.title,
    link: resolveRoute(item.route),
    current:
      currentPath === resolveRoute(item.route) ||
      (resolveRoute(item.route) !== routeBase && currentPath.startsWith(resolveRoute(item.route))),
    icon: item.icon,
    iconSize: 18,
    rightAdornment: item.badge ? item.badge : undefined,
    tooltipText: makeTooltip(item.title, item.description),
    onItemClick: (_it, _collapsed, event) => {
      const e = event as unknown as NavigationClickEvent;
        if (isModifiedClick(e)) {
          return;
        }
        preventDefaultIfPossible(e);
        onNavigate(resolveRoute(item.route));
      },
  });

  const items: MenuItem[] = BASE_ITEMS.filter(visible).map(localizedConfig).map(toMenuItem);

  if (user?.isSuperuser) {
    items.push({
      id: 'admin',
      title: messages.shell.admin,
      link: `${routeBase}/admin`,
      current: currentPath.startsWith(`${routeBase}/admin`),
      icon: Gear,
      iconSize: 18,
      tooltipText: makeTooltip(messages.shell.admin, messages.shell.adminDescription),
      onItemClick: (_it, _collapsed, event) => {
        const e = event as unknown as NavigationClickEvent;
        if (isModifiedClick(e)) {
          return;
        }
        preventDefaultIfPossible(e);
        onNavigate(`${routeBase}/admin`);
      },
    });
    items.push({
      id: 'feature-flags',
      title: messages.shell.featureFlags,
      link: `${routeBase}/feature-flags`,
      current: currentPath.startsWith(`${routeBase}/feature-flags`),
      icon: Gear,
      iconSize: 18,
      tooltipText: makeTooltip(messages.shell.featureFlags, messages.shell.featureFlagsDescription),
      onItemClick: (_it, _collapsed, event) => {
        const e = event as unknown as NavigationClickEvent;
        if (isModifiedClick(e)) {
          return;
        }
        preventDefaultIfPossible(e);
        onNavigate(`${routeBase}/feature-flags`);
      },
    });
  }

  return items;
};
