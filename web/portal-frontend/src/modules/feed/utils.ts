import type { LabelProps } from '@gravity-ui/uikit';

export type FeedEventMeta = {
  icon: string;
  label: string;
  theme: LabelProps['theme'];
};

const EVENT_CONFIG: Record<string, FeedEventMeta> = {
  'vote.cast': { icon: '🗳️', label: 'Голосование', theme: 'info' },
  'event.created': { icon: '📅', label: 'Событие', theme: 'success' },
  'event.rsvp.changed': { icon: '✅', label: 'RSVP', theme: 'success' },
  'post.created': { icon: '📝', label: 'Пост', theme: 'normal' },
  'news.posted': { icon: '📰', label: 'Новости', theme: 'info' },
  'game.achievement': { icon: '🏆', label: 'Достижение', theme: 'warning' },
  'game.playtime': { icon: '🎮', label: 'Игра', theme: 'info' },
  'steam.private': { icon: '🔒', label: 'Steam', theme: 'normal' },
  'minecraft.session': { icon: '⛏️', label: 'Minecraft', theme: 'info' },
};

export const FEED_MVP_EVENT_TYPES = [
  'vote.cast',
  'event.created',
  'event.rsvp.changed',
  'post.created',
  'news.posted',
];

export const KNOWN_EVENT_TYPES = Object.keys(EVENT_CONFIG);

export const getEventMeta = (type: string): FeedEventMeta => {
  if (EVENT_CONFIG[type]) return EVENT_CONFIG[type];

  if (type.startsWith('vote')) {
    return { icon: '🗳️', label: 'Голосование', theme: 'info' };
  }
  if (type.startsWith('event')) {
    return { icon: '📅', label: 'Событие', theme: 'success' };
  }
  if (type.startsWith('game') || type.startsWith('steam') || type.startsWith('minecraft')) {
    return { icon: '🎮', label: 'Игра', theme: 'info' };
  }
  if (type.startsWith('post')) {
    return { icon: '📝', label: 'Пост', theme: 'normal' };
  }
  if (type.startsWith('news')) {
    return { icon: '📰', label: 'Новости', theme: 'info' };
  }

  return { icon: '📌', label: type, theme: 'normal' };
};

export const getEventTypeOptions = (types: string[]) =>
  types.map((type) => {
    const meta = getEventMeta(type);
    return {
      value: type,
      label: `${meta.icon} ${meta.label}`,
    };
  });
