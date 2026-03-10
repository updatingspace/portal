import type {MenuItem} from '@gravity-ui/navigation';

import House from '@gravity-ui/icons/House';
import Pulse from '@gravity-ui/icons/Pulse';
import Calendar from '@gravity-ui/icons/Calendar';
import ListCheck from '@gravity-ui/icons/ListCheck';
import Shield from '@gravity-ui/icons/Shield';
import Gear from '@gravity-ui/icons/Gear';

import type {UserInfo} from '../../contexts/AuthContext';
import {can} from '../rbac/can';

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
  {id: 'dashboard', title: 'Dashboard', description: 'Overview', route: '', icon: House},
  {id: 'feed', title: 'Activity Feed', description: 'Updates and logs', route: '/feed', icon: Pulse, required: 'activity.feed.read'},
  {id: 'events', title: 'Events', description: 'Community events', route: '/events', icon: Calendar, required: 'events.event.read'},
  {id: 'voting', title: 'Voting', description: 'Campaigns and nominations', route: '/voting', icon: ListCheck, required: 'voting.poll.read'},
  {id: 'gamification', title: 'Gamification', description: 'Achievements and grants', route: '/gamification', icon: ListCheck, required: 'gamification.achievements.read'},
  {id: 'tenant-admin', title: 'Tenant Admin', description: 'Roles, rights, access', route: '/tenant-admin', icon: Shield, required: 'portal.roles.read'},
];

function makeTooltip(title: string, description?: string) {
  return description ? `${title}\n${description}` : title;
}

const isModifiedClick = (event: Partial<MouseEvent>): boolean =>
  Boolean(event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1);

const preventDefaultIfPossible = (event: { preventDefault?: () => void }) => {
  if (typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
};

export const buildAsideMenuItems = (params: {
  user: UserInfo | null;
  currentPath: string;
  onNavigate: (to: string) => void;
  /** Route prefix: '/t/aef' or '/app' (legacy). Defaults to '/app'. */
  routeBase?: string;
}): MenuItem[] => {
  const {user, currentPath, onNavigate, routeBase = '/app'} = params;

  const visible = (item: NavItemConfig) => {
    if (!user?.capabilities?.length && !user?.roles?.length) {
      return item.id !== 'admin';
    }
    return can(user, item.required);
  };

  const toMenuItem = (item: NavItemConfig): MenuItem => {
    const fullRoute = `${routeBase}${item.route}`;
    return {
      id: item.id,
      title: item.title,
      link: fullRoute,
      current: currentPath === fullRoute || (item.route !== '' && currentPath.startsWith(fullRoute)),
      icon: item.icon,
      iconSize: 18,
      rightAdornment: item.badge ? item.badge : undefined,
      tooltipText: makeTooltip(item.title, item.description),
      onItemClick: (_it, _collapsed, event) => {
        const e = event as Partial<MouseEvent> & { preventDefault?: () => void };
        if (isModifiedClick(e)) {
          return;
        }
        preventDefaultIfPossible(e);
        onNavigate(fullRoute);
      },
    };
  };

  const items: MenuItem[] = BASE_ITEMS.filter(visible).map(toMenuItem);

  if (user?.isSuperuser) {
    const adminRoute = `${routeBase}/admin`;
    items.push({
      id: 'admin',
      title: 'Admin',
      link: adminRoute,
      current: currentPath.startsWith(adminRoute),
      icon: Gear,
      iconSize: 18,
      tooltipText: makeTooltip('Admin', 'Admin tools'),
      onItemClick: (_it, _collapsed, event) => {
        const e = event as Partial<MouseEvent> & { preventDefault?: () => void };
        if (isModifiedClick(e)) {
          return;
        }
        preventDefaultIfPossible(e);
        onNavigate(adminRoute);
      },
    });
  }

  return items;
};
