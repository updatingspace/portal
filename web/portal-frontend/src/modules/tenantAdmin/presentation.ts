const RESOURCES_EN: Record<string, string> = {
  profile: 'Profile',
  applications: 'Access applications',
  tenant_applications: 'Community applications',
  communities: 'Groups',
  teams: 'Teams',
  posts: 'Posts',
  roles: 'Roles',
  role_bindings: 'Role assignments',
  permissions: 'Permissions',
  poll: 'Polls',
  vote: 'Votes',
  results: 'Results',
  votings: 'Voting',
  nominations: 'Questions',
  event: 'Events',
  rsvp: 'Participation',
  attendance: 'Attendance',
  feed: 'Feed',
  sources: 'Sources',
  admin: 'Administration',
  news: 'Posts',
  achievements: 'Achievements',
  categories: 'Categories',
  preferences: 'Preferences',
  content: 'Content',
  dashboards: 'Overview',
};
const ROLES_EN: Record<string, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  member: 'Member',
  moderator: 'Moderator',
  'tenant-admin': 'Community administrator',
  viewer: 'Viewer',
};
const SERVICES_EN: Record<string, string> = {
  portal: 'Community',
  voting: 'Voting',
  events: 'Events',
  activity: 'Feed and posts',
  gamification: 'Achievements',
  personalization: 'Personalization',
  access: 'Access management',
};
import { getLocale } from '../../shared/lib/locale';
import type {
  PermissionEntry,
  ScopeType,
  TenantAdminEvent,
  TenantRole,
} from './api';

const SERVICES: Record<string, string> = {
  portal: 'Сообщество',
  voting: 'Голосования',
  events: 'События',
  activity: 'Лента и новости',
  gamification: 'Достижения',
  personalization: 'Персонализация',
  access: 'Управление доступом',
};

const ROLES: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  member: 'Участник',
  moderator: 'Модератор',
  'tenant-admin': 'Администратор сообщества',
  viewer: 'Наблюдатель',
};

const RESOURCES: Record<string, string> = {
  profile: 'Личный профиль',
  applications: 'Заявки пользователей',
  tenant_applications: 'Создание сообществ',
  communities: 'Сообщества',
  teams: 'Команды',
  posts: 'Публикации',
  roles: 'Роли',
  role_bindings: 'Назначение ролей',
  permissions: 'Права доступа',
  poll: 'Опросы',
  vote: 'Голоса',
  results: 'Результаты',
  votings: 'Голосования',
  nominations: 'Номинации',
  event: 'События',
  rsvp: 'Участие в событиях',
  attendance: 'Посещаемость',
  feed: 'Лента',
  sources: 'Источники',
  admin: 'Администрирование',
  news: 'Новости',
  achievements: 'Достижения',
  preferences: 'Личные настройки',
  content: 'Контент',
  dashboards: 'Главная страница',
};

const PERMISSIONS: Record<string, string> = {
  'portal.tenant_applications.review':
    'Рассматривать заявки на создание сообществ',
  'portal.profile.read_self': 'Просматривать свой профиль',
  'portal.profile.edit_self': 'Редактировать свой профиль',
  'portal.applications.review': 'Рассматривать заявки пользователей',
  'portal.communities.list': 'Просматривать список сообществ',
  'portal.communities.create': 'Создавать сообщества',
  'portal.communities.read': 'Просматривать сообщество',
  'portal.communities.manage': 'Управлять сообществами',
  'portal.communities.members.read': 'Просматривать участников сообщества',
  'portal.communities.members.manage': 'Управлять участниками сообщества',
  'portal.teams.list': 'Просматривать команды',
  'portal.teams.create': 'Создавать команды',
  'portal.teams.manage': 'Управлять командами',
  'portal.teams.members.read': 'Просматривать участников команды',
  'portal.teams.members.manage': 'Управлять участниками команды',
  'portal.posts.read': 'Читать публикации',
  'portal.posts.create': 'Создавать публикации',
  'portal.posts.create_public': 'Создавать публичные публикации',
  'portal.posts.create_community': 'Публиковать в сообществе',
  'portal.posts.create_team': 'Публиковать в команде',
  'portal.posts.create_private': 'Создавать личные публикации',
  'portal.posts.read_private': 'Читать личные публикации',
  'portal.roles.read': 'Просматривать роли',
  'portal.roles.write': 'Создавать и изменять роли',
  'portal.role_bindings.write': 'Назначать и снимать роли',
  'portal.permissions.read': 'Просматривать каталог прав',
  'voting.poll.read': 'Просматривать опросы',
  'voting.vote.cast': 'Участвовать в голосовании',
  'voting.vote.read_own': 'Просматривать свои голоса',
  'voting.results.read': 'Просматривать результаты голосований',
  'voting.votings.admin': 'Управлять голосованиями',
  'voting.nominations.admin': 'Управлять номинациями',
  'events.event.read': 'Просматривать события',
  'events.event.create': 'Создавать события',
  'events.event.manage': 'Управлять событиями',
  'events.rsvp.set': 'Отвечать на приглашения',
  'events.attendance.mark': 'Отмечать посещаемость',
  'activity.feed.read': 'Читать ленту',
  'activity.sources.link': 'Подключать источники активности',
  'activity.sources.manage': 'Управлять источниками активности',
  'activity.admin.sync': 'Запускать синхронизацию ленты',
  'activity.admin.games': 'Управлять каталогом игр',
  'activity.news.create': 'Публиковать новости',
  'activity.news.manage': 'Управлять новостями',
  'gamification.categories.manage': 'Создавать категории достижений',
  'gamification.achievements.read': 'Просматривать достижения',
  'gamification.achievements.create': 'Создавать достижения',
  'gamification.achievements.edit': 'Редактировать достижения',
  'gamification.achievements.publish': 'Публиковать достижения',
  'gamification.achievements.hide': 'Скрывать достижения',
  'gamification.achievements.assign': 'Выдавать достижения',
  'gamification.achievements.revoke': 'Отзывать достижения',
  'gamification.achievements.view_private': 'Просматривать скрытые достижения',
  'personalization.preferences.edit_own': 'Изменять свои настройки',
  'personalization.preferences.read_own': 'Просматривать свои настройки',
  'personalization.content.manage': 'Управлять контентом главной страницы',
  'personalization.dashboards.customize': 'Настраивать свою главную страницу',
};

export const serviceLabel = (service: string) =>
  (getLocale() === 'en' ? SERVICES_EN : SERVICES)[service] ?? service;
export const roleLabel = (name: string) =>
  (getLocale() === 'en' ? ROLES_EN : ROLES)[name] ?? name;
export const resourceLabel = (resource: string) =>
  (getLocale() === 'en' ? RESOURCES_EN : RESOURCES)[resource] ?? resource;
export const permissionLabel = (
  permission: PermissionEntry | string,
): string => {
  const key = typeof permission === 'string' ? permission : permission.key;
  if (getLocale() === 'en')
    return typeof permission === 'string'
      ? key.split('.').slice(1).join(' ').replaceAll('_', ' ')
      : permission.description || key;
  return (
    PERMISSIONS[key] ??
    (typeof permission === 'string' ? key : permission.description || key)
  );
};

export function scopeLabel(
  type: ScopeType | string,
  id: string,
  tenantId: string,
): string {
  if (getLocale() === 'en')
    return type === 'TENANT'
      ? 'Entire community'
      : type === 'GLOBAL'
        ? 'Platform'
        : type === 'TEAM'
          ? 'Team'
          : type === 'COMMUNITY'
            ? 'Group'
            : type === 'SERVICE'
              ? serviceLabel(id)
              : 'Limited scope';
  if (type === 'TENANT' && id === tenantId) return 'Всё сообщество';
  if (type === 'GLOBAL') return 'Вся платформа';
  if (type === 'SERVICE') return serviceLabel(id);
  if (type === 'TEAM') return 'Отдельная команда';
  if (type === 'COMMUNITY') return 'Отдельная группа';
  return 'Ограниченная область доступа';
}

export function presentAuditEvent(
  event: TenantAdminEvent,
  roles: TenantRole[],
  memberName: (id: string) => string,
) {
  const meta = event.metadata ?? {};
  const roleId = String(
    meta.role_id ?? (event.target_type === 'role' ? event.target_id : '') ?? '',
  );
  const role = roles.find((item) => String(item.id) === roleId);
  // Prefer the historical name when the event captured it.
  const name = typeof meta.name === 'string' ? meta.name : role?.name;
  const service =
    typeof meta.service === 'string' ? meta.service : role?.service;
  const roleName = name ? roleLabel(name) : 'Роль недоступна';
  const recipient =
    typeof meta.user_id === 'string' ? memberName(meta.user_id) : 'Участник';
  const subject = service ? `${roleName} · ${serviceLabel(service)}` : roleName;
  const actions: Record<string, { title: string; description: string }> = {
    tenant_owner_provisioned: {
      title: 'Предоставлен доступ владельцу',
      description: `Владелец: ${recipient}.${service ? ` Раздел: ${serviceLabel(service)}.` : ''}`,
    },
    binding_created: {
      title: 'Назначена роль',
      description: `${recipient} — ${subject}.`,
    },
    binding_deleted: {
      title: 'Роль снята',
      description: `${recipient} — ${subject}.`,
    },
    role_created: { title: 'Создана роль', description: subject },
    role_updated: { title: 'Изменена роль', description: subject },
    role_deleted: { title: 'Удалена роль', description: subject },
    'dsar.exported': {
      title: 'Выгружены данные участника',
      description: 'Подготовлена выгрузка данных по запросу.',
    },
    'dsar.erased': {
      title: 'Удалены данные участника',
      description: 'Обработан запрос на удаление данных.',
    },
  };
  if (getLocale() === 'en') {
    const titles: Record<string, string> = {
      tenant_owner_provisioned: 'Owner access granted',
      binding_created: 'Role assigned',
      binding_deleted: 'Role removed',
      role_created: 'Role created',
      role_updated: 'Role updated',
      role_deleted: 'Role deleted',
      'dsar.exported': 'Member data exported',
      'dsar.erased': 'Member data erased',
    };
    return {
      title: titles[event.action] || 'Access changed',
      description: `${typeof meta.user_id === 'string' ? memberName(meta.user_id) + ' · ' : ''}${name ? roleLabel(name) : 'Role unavailable'}${service ? ' · ' + serviceLabel(service) : ''}`,
      actor: memberName(event.performed_by),
    };
  }
  return {
    ...(actions[event.action] ?? {
      title: 'Изменение доступа',
      description: 'Подробности события доступны в технических данных.',
    }),
    actor: memberName(event.performed_by),
  };
}
