import type { Game } from '../types/games';

export type NominationOption = {
  id: string;
  title: string;
  imageUrl?: string;
  game?: Game | null;
};

export type Voting = {
  id: string;
  title: string;
  description?: string;
  isActive: boolean;
  isOpen: boolean;
  deadlineAt?: string | null;
  showVoteCounts?: boolean;
  rules?: Record<string, unknown>;
};

export type Nomination = {
  id: string;          // строковый id для маршрута
  title: string;
  description?: string;
  options: NominationOption[];
  counts?: Record<string, number>;
  userVote?: string | null;
  isVotingOpen?: boolean;
  canVote?: boolean;
  requiresTelegramLink?: boolean;
  votingDeadline?: string | null;
  voting?: Voting | null;
};

const votingTemplates: Voting[] = [
  {
    id: 'main',
    title: 'Основное голосование',
    description: 'Главный поток — всё самое важное для сообщества.',
    isActive: true,
    isOpen: true,
    deadlineAt: null,
    showVoteCounts: false,
    rules: {
      notes: 'Основной тур для ежегодного голосования.',
    },
  },
  {
    id: 'test',
    title: 'Тестовое голосование',
    description: 'Выясняем, как выглядит интерфейс с открытыми результатами.',
    isActive: true,
    isOpen: true,
    deadlineAt: null,
    showVoteCounts: true,
    rules: {
      notes: 'Демонстрационный поток.',
    },
  },
];

export const nominations: Nomination[] = Array.from(
  { length: 19 },
  (_, index): Nomination => {
    // Чередуем по 6 и 5 вариантов, чтобы проверить оба варианта выравнивания
    const optionsCount = index % 2 === 0 ? 6 : 5;

    const options: NominationOption[] = Array.from(
      { length: optionsCount },
      (__, optIndex) => ({
        id: `nom-${index + 1}-opt-${optIndex + 1}`,
        title: `Игра ${optIndex + 1}`,
      }),
    );

    const voting = votingTemplates[index % votingTemplates.length];

    return {
      id: String(index + 1),
      title: `Номинация ${index + 1}`,
      description: 'Краткое описание номинации. Текст-заглушка.',
      options,
      voting,
    };
  },
);
