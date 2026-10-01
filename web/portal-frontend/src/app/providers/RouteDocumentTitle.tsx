import { useUITranslation } from '../../shared/ui/portal/PortalUI';
import React, { useMemo } from 'react';
import { useMatches } from 'react-router-dom';

import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';

type RouteTitleResolver = (
  params: Record<string, string | undefined>,
) => string | null | undefined;

type RouteTitleHandle = {
  title?: string | RouteTitleResolver;
};

type RouteMatch = {
  handle?: RouteTitleHandle;
  params: Record<string, string | undefined>;
};

const resolveRouteTitle = (matches: RouteMatch[]): string | null => {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const title = match?.handle?.title;

    if (typeof title === 'function') {
      const resolved = title(match.params);
      if (typeof resolved === 'string' && resolved.trim()) {
        return resolved.trim();
      }
      continue;
    }

    if (typeof title === 'string' && title.trim()) {
      return title.trim();
    }
  }

  return null;
};

export const RouteDocumentTitle: React.FC = () => {
  const matches = useMatches() as RouteMatch[];

  const pageTitle = useMemo(() => resolveRouteTitle(matches), [matches]);

  const t = useUITranslation();
  const titles: Record<string, string> = {
    Overview: 'Обзор',
    Лента: 'Activity feed',
    Новость: 'Post',
    События: 'Events',
    'Создание события': 'Create event',
    Событие: 'Event',
    'Редактирование события': 'Edit event',
    Опросы: 'Voting',
    'Создание опроса': 'Create poll',
    'Шаблоны опросов': 'Poll templates',
    'Аналитика голосований': 'Voting analytics',
    Опрос: 'Poll',
    'Управление опросом': 'Manage poll',
    'Результаты опроса': 'Poll results',
    Профиль: 'Profile',
    Настройки: 'Settings',
    Администрирование: 'Administration',
    'Управление сообществом': 'Community management',
    'Функции платформы': 'Platform features',
    Геймификация: 'Achievements',
    'Новая ачивка': 'New achievement',
    'Редактирование ачивки': 'Edit achievement',
    'Карточка ачивки': 'Achievement',
    Главная: 'Home',
    Вход: 'Sign in',
    'Активация приглашения': 'Invitation',
    'Выбор сообщества': 'My communities',
    Подписки: 'Following',
    Подписчики: 'Followers',
    Сообщества: 'Communities',
    Ачивки: 'Achievements',
    Друзья: 'Friends',
  };
  useDocumentTitle(
    pageTitle === 'Overview'
      ? t('Обзор', 'Overview')
      : pageTitle
        ? t(pageTitle, titles[pageTitle] ?? pageTitle)
        : null,
  );

  return null;
};
