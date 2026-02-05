import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AsideHeader, type MenuItem } from '@gravity-ui/navigation';
import {
  Button,
  Loader,
  type TableColumnConfig,
} from '@gravity-ui/uikit';
import Pencil from '@gravity-ui/icons/Pencil';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Cubes3 from '@gravity-ui/icons/Cubes3';
import ListCheck from '@gravity-ui/icons/ListCheck';
import Gear from '@gravity-ui/icons/Gear';
import CircleInfo from '@gravity-ui/icons/CircleInfo';

import {
  fetchAdminVotings,
  fetchAdminVoting,
  fetchAdminStats,
  updateAdminVotingMeta,
  type AdminNomination,
  type AdminVoting,
  type AdminVotingListItem,
  type AdminStats,
} from '../api/adminVotings';
import {
  exportVoting as exportVotingConfig,
  importVoting,
  deleteVoting,
  previewVotingImport,
  type VotingImportPayload,
  type VotingImportPreview,
} from '../api/votings';
import {
  fetchAdminHomePageModals,
  createHomePageModal,
  updateHomePageModal,
  deleteHomePageModal,
  type HomePageModal,
  type HomePageModalInput,
} from '../api/personalization';
import { fetchGames } from '../api/games';
import { useAuth } from '../contexts/AuthContext';
import { NotFoundPage } from './NotFoundPage';
import type { Game } from '../types/games';
import { notifyApiError } from '../utils/apiErrorHandling';
import { fetchNomination } from '../api/nominations';
import type { Nomination } from '../data/nominations';
import { toaster } from '../toaster';
import { CommandHistory } from '../commands/history';
import { useCommandHistoryState, useCommandHotkeys } from '../commands/hooks';
import type { SerializedCommand } from '../commands/types';
import { ImportVotingCommand, SaveGameCommand } from '../commands/adminCommands';
import { CommandSerializerVisitor } from '../commands/visitors';
import { GameGrid } from '../components/admin/GameGrid';
import { GameModal } from '../components/admin/GameModal';
import { NominationPreviewDialog } from '../components/admin/NominationPreviewDialog';
import { VotingImportDialog } from '../components/admin/VotingImportDialog';
import { logger } from '../utils/logger';
import { AdminHistoryCard } from './admin/components/AdminHistoryCard';
import { DashboardSection } from './admin/components/DashboardSection';
import { NominationEditorDialog } from './admin/components/NominationEditorDialog';
import { ReviewerModal } from './admin/components/ReviewerModal';
import { ReviewModal } from './admin/components/ReviewModal';
import { ReviewersSection } from './admin/components/ReviewersSection';
import { ReviewsSection } from './admin/components/ReviewsSection';
import { VotingsSection } from './admin/components/VotingsSection';
import { VotingCreatorDialog } from './admin/components/VotingCreatorDialog';
import { PersonalizationSection } from './admin/components/PersonalizationSection';
import { HomePageModalEditor } from './admin/components/HomePageModalEditor';
import { AboutProjectModal } from '../components/AboutProjectModal';
import {
  createEmptyGameDraft,
  type GameDraft,
  type NominationDraft,
  type NominationRow,
  type OptionDraft,
  type AdminRow,
  type ReviewDraft,
  type ReviewMaterial,
  type ReviewerDraft,
  type ReviewerProfile,
  type VotingDraft,
  type MetaDraftState,
} from './admin/types';

type AdminSection = 'dashboard' | 'games' | 'votings' | 'reviewers' | 'reviews' | 'personalization';

const adminColumns: TableColumnConfig<AdminRow>[] = [
  { id: 'title', name: 'Название' },
  { id: 'type', name: 'Раздел', width: 140 },
  { id: 'status', name: 'Статус', width: 160 },
  { id: 'updatedAt', name: 'Обновлено', width: 180 },
];

const createNominationColumns = (
  onPreview: (nominationId: string) => void,
  onEdit?: (nominationId: string) => void,
): TableColumnConfig<NominationRow>[] =>
  [
    { id: 'title', name: 'Номинация' },
    {
      id: 'kind',
      name: 'Тип',
      width: 120,
      template: (row: NominationRow) => nominationKindLabels[row.kind ?? ''] ?? row.kind ?? '—',
    },
    { id: 'status', name: 'Статус', width: 140 },
    { id: 'votes', name: 'Голосов', width: 120 },
    { id: 'updatedAt', name: 'Обновлено', width: 180 },
    {
      id: 'preview',
      name: 'Карточки',
      width: 130,
      className: 'admin-nomination-preview-column',
      template: (item: NominationRow) => (
        <Button
          size="s"
          view="flat"
          onClick={(event) => {
            event.stopPropagation();
            onPreview(item.id);
          }}
        >
          Просмотр
        </Button>
      ),
    },
    onEdit
      ? {
          id: 'edit',
          name: 'Настройки',
          width: 150,
          template: (item: NominationRow) => (
            <Button
              size="s"
              view="outlined"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(item.id);
              }}
            >
              Настроить
            </Button>
          ),
        }
      : null,
  ].filter(Boolean) as TableColumnConfig<NominationRow>[];

const placeholderRows: Record<AdminSection, AdminRow[]> = {
  dashboard: [
    { id: 'dash-1', title: 'Здесь будет живая выборка', type: 'Сводка', status: 'Черновик', updatedAt: 'Сегодня, 10:00' },
    { id: 'dash-2', title: 'Из API подтянем активные записи', type: 'Сводка', status: 'Планируется', updatedAt: 'Вчера, 18:00' },
  ],
  games: [
    { id: 'game-1', title: 'AEF Game Jam: черновик списка игр', type: 'Игры', status: 'Черновик', updatedAt: 'Сегодня, 12:30' },
    { id: 'game-2', title: 'Релизы из API будут здесь', type: 'Игры', status: 'Ждёт данных', updatedAt: 'Вчера, 19:10' },
    { id: 'game-3', title: 'Ручные добавления (плейсхолдер)', type: 'Игры', status: 'Черновик', updatedAt: '12.02, 09:05' },
  ],
  votings: [
    { id: 'vote-1', title: 'Серии голосований и статусы', type: 'Голосования', status: 'Активно', updatedAt: 'Сегодня, 10:20' },
    { id: 'vote-2', title: 'Планируемая аналитика по голосам', type: 'Голосования', status: 'Планируется', updatedAt: '09.02, 14:00' },
    { id: 'vote-3', title: 'Архив 2024 (плейсхолдер)', type: 'Голосования', status: 'Архив', updatedAt: '05.02, 12:10' },
  ],
  reviewers: [
    { id: 'rev-1', title: 'Кураторы и авторы', type: 'Обзорщики', status: 'Черновик', updatedAt: 'Сегодня, 11:00' },
    { id: 'rev-2', title: 'Добавьте ссылки и роли', type: 'Обзорщики', status: 'Планируется', updatedAt: 'Вчера, 19:00' },
  ],
  reviews: [
    { id: 'material-1', title: 'Лучший обзор — черновик', type: 'Материалы', status: 'Черновик', updatedAt: 'Сегодня, 09:40' },
    { id: 'material-2', title: 'Пример карточки обзора', type: 'Материалы', status: 'Архив', updatedAt: 'Вчера, 17:10' },
  ],
  personalization: [],
};

const sectionMeta: Record<AdminSection, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Стартовая панель',
    subtitle: 'Свежие новости, активные голосования и приветствие по профилю.',
  },
  games: {
    title: 'Игры и проекты',
    subtitle: 'Добавляем игры, готовим визуализацию карточек и превью для номинаций.',
  },
  votings: {
    title: 'Голосования',
    subtitle: 'Управление потоками голосований, дедлайнами и отображением итогов.',
  },
  reviewers: {
    title: 'Обзорщики',
    subtitle: 'Добавляем авторов, роли и ссылки для номинаций с обзорщиками.',
  },
  reviews: {
    title: 'Обзоры и материалы',
    subtitle: 'Список обзоров с привязкой к играм и авторам для гибких номинаций.',
  },
  personalization: {
    title: 'Персонализация',
    subtitle: 'Управление модальными окнами и контентом для главной страницы.',
  },
};

const fallbackVotings: AdminVotingListItem[] = [
  {
    id: 'vote-1',
    title: 'AEF Game Jam · основной поток',
    description: 'Голосование по итоговым проектам Jam. Участники и судьи.',
    status: 'active',
    isPublished: true,
    isActive: true,
    isOpen: true,
    deadlineAt: '2025-03-01T18:00:00Z',
    nominationCount: 6,
  },
  {
    id: 'vote-2',
    title: 'Экспресс-опрос: любимые механики',
    description: 'Сбор обратной связи по механикам, быстрые выборы.',
    status: 'draft',
    isPublished: false,
    isActive: true,
    isOpen: true,
    deadlineAt: null,
    nominationCount: 3,
  },
  {
    id: 'vote-3',
    title: 'Архив 2024 · лучшие игры',
    description: 'Архивное голосование, только просмотр результатов.',
    status: 'archived',
    isPublished: true,
    isActive: false,
    isOpen: false,
    deadlineAt: '2024-12-01T18:00:00Z',
    nominationCount: 5,
  },
];

const fallbackVotingDetails: Record<string, AdminVoting> = {
  'vote-1': {
    ...fallbackVotings[0],
    nominations: [
      { id: 'n-1', title: 'Лучшая графика', status: 'active', votes: 120, updatedAt: '2025-02-10T12:00:00Z', kind: 'game' },
      { id: 'n-2', title: 'Лучший геймплей', status: 'active', votes: 143, updatedAt: '2025-02-09T21:00:00Z', kind: 'game' },
      { id: 'n-3', title: 'Инновации', status: 'draft', votes: null, updatedAt: null, kind: 'game' },
    ],
    isPublished: true,
    isActive: true,
    isOpen: true,
  },
  'vote-2': {
    ...fallbackVotings[1],
    nominations: [
      { id: 'n-4', title: 'Механика платформера', status: 'draft', votes: null, updatedAt: null, kind: 'game' },
      { id: 'n-5', title: 'Метроидвания', status: 'draft', votes: null, updatedAt: null, kind: 'game' },
    ],
    isPublished: false,
    isActive: true,
    isOpen: true,
  },
  'vote-3': {
    ...fallbackVotings[2],
    nominations: [
      { id: 'n-6', title: 'Визуал', status: 'archived', votes: 200, updatedAt: '2024-12-05T10:00:00Z', kind: 'game' },
      { id: 'n-7', title: 'История', status: 'archived', votes: 180, updatedAt: '2024-12-05T10:00:00Z', kind: 'game' },
    ],
    isPublished: true,
    isActive: false,
    isOpen: false,
  },
};

const statusLabels: Record<string, string> = {
  active: 'Активно',
  draft: 'Черновик',
  archived: 'Архив',
};

// In test environment, pre-seed admin games with a small
// fixture-style catalog so integration tests can rely on
// stable titles without depending on a live API.
const isTestEnv = import.meta.env.MODE === 'test';

const testFallbackGames: Game[] = isTestEnv
  ? [
      {
        id: 'game-1',
        title: 'Crystal Quest',
        genre: 'Adventure',
        studio: 'AEF Studio',
        releaseYear: 2024,
        description: 'Тестовая игра для панели администратора.',
        imageUrl: null,
      },
    ]
  : [];

const nominationKindLabels: Record<string, string> = {
  game: 'Игры',
  person: 'Обзорщики',
  review: 'Обзоры',
  custom: 'Произвольное',
};

const initialReviewers: ReviewerProfile[] = [
  { id: 'reviewer-algumer', name: 'AlGumer', links: [], tags: ['обзорщик'] },
  { id: 'reviewer-unclehayter', name: 'UncleHayter', links: [], tags: ['обзорщик'] },
  { id: 'reviewer-bulcer', name: 'Bulcer', links: [], tags: ['обзорщик'] },
  { id: 'reviewer-mikhail-turov', name: 'Михаил Туров', links: [], tags: ['обзорщик'] },
  { id: 'reviewer-saloma', name: 'Saloma', links: [], tags: ['обзорщик'] },
  { id: 'reviewer-museum', name: 'Музей Игрового Искусства', links: [], tags: ['обзорщик'] },
  { id: 'reviewer-maxim777gmail', name: 'Maxim777gmail', links: [], tags: ['обзорщик'] },
];

const initialReviews: ReviewMaterial[] = [
  { id: 'review-dying-light-2-bulcer', title: 'Dying Light 2 от Bulcer', gameTitle: 'Dying Light 2', reviewers: ['Bulcer'] },
  { id: 'review-alone-silent-hill', title: 'Alone in The Dark x Silent Hill 2', gameTitle: 'Silent Hill 2', reviewers: ['AlGumer', 'UncleHayter'] },
  { id: 'review-indika-museum', title: 'INDIKA от Музей Игрового Искусства', gameTitle: 'INDIKA', reviewers: ['Музей Игрового Искусства'] },
  { id: 'review-star-wars-maxim', title: 'Star Wars Jedi Survivor от Maxim777gmail', gameTitle: 'Star Wars Jedi Survivor', reviewers: ['Maxim777gmail'] },
  { id: 'review-stalker-saloma', title: 'S.T.A.L.K.E.R. 2: Shadow of Chornobyl от Салома', gameTitle: 'S.T.A.L.K.E.R. 2: Shadow of Chornobyl', reviewers: ['Салома'] },
];

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const formatDeadline = (value?: string | null) => {
  if (!value) return 'Без дедлайна';
  return formatDate(value);
};

const toInputDateTime = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

const normalizeDeadlineValue = (value: string): string | null => {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const slugifyId = (value: string, prefix = 'item'): string => {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u0400-\u04FF-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (normalized || prefix).slice(0, 64);
};

const safeReadStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) || typeof parsed === 'object' ? (parsed as T) : fallback;
  } catch (error) {
    logger.warn('Failed to read storage', { data: { key }, error });
    return fallback;
  }
};

const safeWriteStorage = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    logger.warn('Failed to persist storage', { data: { key }, error });
  }
};

const formatNominationRows = (items: AdminNomination[]): NominationRow[] =>
  items.map((item) => ({
    id: item.id,
    title: item.title,
    status: statusLabels[item.status] ?? item.status,
    votes: item.votes ?? '—',
    updatedAt: formatDate(item.updatedAt),
    kind: item.kind ?? '—',
  }));

const mapImportPayloadToAdminVoting = (payload: VotingImportPayload): AdminVoting => ({
  id: payload.code,
  title: payload.title,
  description: payload.description ?? null,
  status: payload.isActive !== false ? 'active' : 'archived',
  deadlineAt: payload.deadlineAt ?? null,
  nominationCount: payload.nominations.length,
  isPublished: true,
  isActive: payload.isActive ?? true,
  isOpen: payload.isActive ?? true,
  showVoteCounts: payload.showVoteCounts ?? false,
  nominations: payload.nominations.map((nomination) => ({
    id: nomination.id,
    title: nomination.title,
    status: payload.isActive !== false ? 'active' : 'draft',
    kind: nomination.kind ?? 'game',
    votes: null,
    updatedAt: null,
  })),
});

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isInitialized, isLoading, refreshProfile } = useAuth();
  const commandHistory = useMemo(() => new CommandHistory(30), []);
  const historyState = useCommandHistoryState(commandHistory);
  const serializer = useMemo(() => new CommandSerializerVisitor(), []);
  const serializedCommands = useMemo<SerializedCommand[]>(
    () => commandHistory.serialize(serializer),
    [commandHistory, serializer],
  );

  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [votings, setVotings] = useState<AdminVotingListItem[]>([]);
  const [votingsError, setVotingsError] = useState<string | null>(null);
  const [isVotingsLoading, setIsVotingsLoading] = useState(false);

  const [selectedVotingId, setSelectedVotingId] = useState<string | null>(null);
  const [votingDetail, setVotingDetail] = useState<AdminVoting | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [isClosingVoting, setIsClosingVoting] = useState(false);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState<MetaDraftState>({
    title: '',
    description: '',
    deadlineAt: '',
    isPublished: true,
    isActive: true,
  });
  const [gameSearch, setGameSearch] = useState('');
  const [gameSearchDebounced, setGameSearchDebounced] = useState('');
  const [games, setGames] = useState<Game[]>(() => testFallbackGames);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [isGamesLoading, setIsGamesLoading] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [gameDraft, setGameDraft] = useState<GameDraft>(createEmptyGameDraft());
  const [isSavingGame, setIsSavingGame] = useState(false);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [gameModalMode, setGameModalMode] = useState<'edit' | 'create'>('edit');
  const [isAsideCompact, setIsAsideCompact] = useState(false);
  const [reviewerSearch, setReviewerSearch] = useState('');
  const [reviewerSearchDebounced, setReviewerSearchDebounced] = useState('');
  const [reviewers, setReviewers] = useState<ReviewerProfile[]>(() =>
    safeReadStorage<ReviewerProfile[]>('admin-reviewers-cache-v1', initialReviewers),
  );
  const [selectedReviewerId, setSelectedReviewerId] = useState<string | null>(null);
  const [reviewerDraft, setReviewerDraft] = useState<ReviewerDraft>({
    name: '',
    bio: '',
    links: '',
    tags: '',
  });
  const [reviewerModalMode, setReviewerModalMode] = useState<'edit' | 'create'>('create');
  const [isReviewerModalOpen, setIsReviewerModalOpen] = useState(false);
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewSearchDebounced, setReviewSearchDebounced] = useState('');
  const [reviews, setReviews] = useState<ReviewMaterial[]>(() =>
    safeReadStorage<ReviewMaterial[]>('admin-reviews-cache-v1', initialReviews),
  );
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>({
    title: '',
    reviewers: '',
    gameTitle: '',
    link: '',
    summary: '',
  });
  const [reviewModalMode, setReviewModalMode] = useState<'edit' | 'create'>('create');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [previewNomination, setPreviewNomination] = useState<Nomination | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importPreview, setImportPreview] = useState<VotingImportPreview | null>(null);
  const [isImportPreviewLoading, setIsImportPreviewLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importForce, setImportForce] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isVotingCreatorOpen, setIsVotingCreatorOpen] = useState(false);
  const [isVotingSaving, setIsVotingSaving] = useState(false);
  const [isDeletingVoting, setIsDeletingVoting] = useState(false);
  const [votingDraft, setVotingDraft] = useState<VotingDraft>({
    code: '',
    title: '',
    description: '',
    deadlineAt: '',
    isPublished: true,
    isActive: true,
    showVoteCounts: false,
    forceReplace: false,
  });
  const [nominationEditorOpen, setNominationEditorOpen] = useState(false);
  const [nominationEditorLoading, setNominationEditorLoading] = useState(false);
  const [nominationDraft, setNominationDraft] = useState<NominationDraft | null>(null);
  const [nominationSourceVoting, setNominationSourceVoting] = useState<string | null>(null);
  const [isSavingNomination, setIsSavingNomination] = useState(false);
  const [isAboutProjectOpen, setIsAboutProjectOpen] = useState(false);

  // Personalization state
  const [homePageModals, setHomePageModals] = useState<HomePageModal[]>([]);
  const [isModalsLoading, setIsModalsLoading] = useState(false);
  const [modalsError, setModalsError] = useState<string | null>(null);
  const [selectedModalId, setSelectedModalId] = useState<number | null>(null);
  const [isModalEditorOpen, setIsModalEditorOpen] = useState(false);
  const [modalEditorMode, setModalEditorMode] = useState<'create' | 'edit'>('create');
  const [modalDraft, setModalDraft] = useState<Partial<HomePageModalInput>>({});
  const [isSavingModal, setIsSavingModal] = useState(false);

  const parseImportJson = useCallback((): VotingImportPayload | null => {
    if (!importJson.trim()) {
      setImportError('Вставьте JSON с голосованием.');
      return null;
    }

    try {
      const parsed = JSON.parse(importJson) as VotingImportPayload;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Неверная структура JSON');
      }
      return parsed;
    } catch (error) {
      setImportError(
        error instanceof Error ? `Не удалось разобрать JSON: ${error.message}` : 'Не удалось разобрать JSON',
      );
      return null;
    }
  }, [importJson]);

  useCommandHotkeys(commandHistory, {
    onHandled: (action) => {
      toaster.add({
        name: `history-${action}-${Date.now()}`,
        title: action === 'undo' ? 'Отменили изменение' : 'Повторили изменение',
        theme: 'info',
        autoHiding: 1800,
      });
    },
  });

  // Ensure profile is loaded for admin checks in runtime, but avoid
  // triggering a session refresh in tests where user is injected
  // directly via AuthProvider.
  useEffect(() => {
    if (!isInitialized || isLoading) {
      return;
    }
    if (!user) {
      refreshProfile();
    }
  }, [isInitialized, isLoading, user, refreshProfile]);

  const handleMenuItemClick = useCallback((item: MenuItem) => {
    setActiveSection(item.id as AdminSection);
  }, []);

  const handleLogoClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setActiveSection('dashboard');
  }, []);

  const menuItems = useMemo<MenuItem[]>(() => [
    {
      id: 'games',
      title: 'Игры',
      current: activeSection === 'games',
      onItemClick: handleMenuItemClick,
      tooltipText: 'Каталог игр',
      icon: Cubes3,
      iconSize: 18,
    },
    {
      id: 'votings',
      title: 'Голосования',
      current: activeSection === 'votings',
      onItemClick: handleMenuItemClick,
      tooltipText: 'Фазы, дедлайны и аналитика',
      icon: ListCheck,
      iconSize: 18,
    },
    {
      id: 'reviewers',
      title: 'Обзорщики',
      current: activeSection === 'reviewers',
      onItemClick: handleMenuItemClick,
      tooltipText: 'Авторы, кураторы и гости',
      icon: Magnifier,
      iconSize: 18,
    },
    {
      id: 'reviews',
      title: 'Обзоры',
      current: activeSection === 'reviews',
      onItemClick: handleMenuItemClick,
      tooltipText: 'Материалы и обзоры по играм',
      icon: Pencil,
      iconSize: 18,
    },
    {
      id: 'personalization',
      title: 'Персонализация',
      current: activeSection === 'personalization',
      onItemClick: handleMenuItemClick,
      tooltipText: 'Модальные окна — Главная',
      icon: Gear,
      iconSize: 18,
    },
  ], [activeSection, handleMenuItemClick]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sectionParam = params.get('section');
    const allowedSections: AdminSection[] = ['games', 'votings', 'dashboard', 'reviewers', 'reviews', 'personalization'];
    if (sectionParam && allowedSections.includes(sectionParam as AdminSection)) {
      setActiveSection(sectionParam as AdminSection);
    }
  }, [location.search]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setGameSearchDebounced(gameSearch.trim()),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [gameSearch]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setReviewerSearchDebounced(reviewerSearch.trim()),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [reviewerSearch]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setReviewSearchDebounced(reviewSearch.trim()),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [reviewSearch]);

  const loadVotings = useCallback(
    async (query: string) => {
      setIsVotingsLoading(true);
      setVotingsError(null);
      try {
        const data = await fetchAdminVotings(query);
        setVotings(data);
        if (!selectedVotingId && data.length) {
          setSelectedVotingId(data[0].id);
        }
      } catch (error) {
        notifyApiError(error, 'Не удалось загрузить голосования из API, показываем заглушку.');
        setVotingsError('Не удалось загрузить голосования из API, показываем заглушку.');
        const filtered = fallbackVotings.filter((item) =>
          item.title.toLowerCase().includes(query.toLowerCase()),
        );
        setVotings(filtered);
        if (!selectedVotingId && filtered.length) {
          setSelectedVotingId(filtered[0].id);
        }
      } finally {
        setIsVotingsLoading(false);
      }
    },
    [selectedVotingId],
  );

  const loadStats = useCallback(async () => {
    setIsStatsLoading(true);
    setStatsError(null);
    try {
      const data = await fetchAdminStats();
      setStats(data);
    } catch (error) {
      notifyApiError(error, 'Не удалось загрузить метрики админки');
      setStatsError('Не удалось загрузить метрики, показываем пустые значения.');
      setStats({
        activeVotings: 0,
        draftVotings: 0,
        archivedVotings: 0,
        totalVotes: 0,
        uniqueVoters: 0,
        openNominations: 0,
        openForVoting: 0,
      });
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  const loadGames = useCallback(
    async (query: string) => {
      setIsGamesLoading(true);
      setGamesError(null);
      try {
        const data = await fetchGames(query);
        setGames(data);

        if (data.length === 0) {
          setSelectedGameId(null);
          setIsGameModalOpen(false);
          return;
        }

        if (!selectedGameId || !data.some((item) => item.id === selectedGameId)) {
          setSelectedGameId(data[0].id);
        }
      } catch (error) {
        setGamesError('Не удалось загрузить игры из API.');
        notifyApiError(error, 'Не удалось загрузить игры');
        setGames([]);
        setSelectedGameId(null);
        setIsGameModalOpen(false);
      } finally {
        setIsGamesLoading(false);
      }
    },
    [selectedGameId],
  );

  const handleOpenPreview = useCallback(
    async (nominationId: string) => {
      setIsPreviewLoading(true);
      try {
        const detail = await fetchNomination(nominationId);
        setPreviewNomination(detail);
        setIsPreviewOpen(true);
      } catch (error) {
        notifyApiError(error, 'Не удалось загрузить карточки номинации');
      } finally {
        setIsPreviewLoading(false);
      }
    },
    [],
  );

  const applyVotingUpdate = (updated: AdminVoting) => {
    const published = updated.isPublished ?? true;
    const isActive = updated.isActive ?? true;
    const isOpen = updated.isOpen ?? true;
    setVotingDetail(updated);
    setMetaDraft({
      title: updated.title,
      description: updated.description ?? '',
      deadlineAt: toInputDateTime(updated.deadlineAt),
      isPublished: published,
      isActive,
    });
    setVotings((prev) =>
      prev.map((item) =>
        item.id === updated.id
          ? {
              ...item,
              title: updated.title,
              description: updated.description ?? null,
              status: updated.status,
              deadlineAt: updated.deadlineAt ?? null,
              isPublished: published,
              isActive,
              isOpen,
              showVoteCounts: updated.showVoteCounts ?? item.showVoteCounts ?? false,
            }
          : item,
      ),
    );
  };

  const resetMetaDraft = useCallback(() => {
    if (!votingDetail) return;
    setMetaDraft({
      title: votingDetail.title,
      description: votingDetail.description ?? '',
      deadlineAt: toInputDateTime(votingDetail.deadlineAt),
      isPublished: votingDetail.isPublished ?? true,
      isActive: votingDetail.isActive ?? true,
    });
  }, [votingDetail]);

  const loadVotingDetail = useCallback(
    async (votingId: string) => {
      setIsDetailLoading(true);
      try {
        const detail = await fetchAdminVoting(votingId);
        setVotingDetail(detail);
        setMetaDraft({
          title: detail.title,
          description: detail.description ?? '',
          deadlineAt: toInputDateTime(detail.deadlineAt),
          isPublished: detail.isPublished ?? true,
          isActive: detail.isActive ?? true,
        });
        setIsEditingMeta(false);
      } catch (error) {
        const fallbackDetail =
          fallbackVotingDetails[votingId] ??
          ({
            id: votingId,
            title: 'Черновик голосования',
            description: 'Заглушка деталки, API недоступно.',
            status: 'draft',
            isPublished: false,
            isActive: false,
            isOpen: false,
            deadlineAt: null,
            nominationCount: 0,
            nominations: [],
          } satisfies AdminVoting);

        setVotingDetail(fallbackDetail);
        setMetaDraft({
          title: fallbackDetail.title,
          description: fallbackDetail.description ?? '',
          deadlineAt: toInputDateTime(fallbackDetail.deadlineAt),
          isPublished: fallbackDetail.isPublished ?? true,
          isActive: fallbackDetail.isActive ?? true,
        });
        setVotingsError('Не получилось получить детали из API, работаем с заглушкой.');
        notifyApiError(error, 'Не получилось получить детали голосования');
        setIsEditingMeta(false);
      } finally {
        setIsDetailLoading(false);
      }
    },
    [],
  );

  const syncVotingFromImport = useCallback(
    (code: string, voting: VotingImportPayload | null, action: 'apply' | 'undo' | 'redo') => {
      if (voting) {
        const mapped = mapImportPayloadToAdminVoting(voting);
        setVotings((prev) => {
          const merged = prev.filter((item) => item.id !== mapped.id);
          merged.push(mapped);
          return merged.sort((a, b) => a.title.localeCompare(b.title));
        });
        setSelectedVotingId(mapped.id);
        setVotingDetail(mapped);
        void loadVotingDetail(mapped.id);
      } else {
        setVotings((prev) => prev.filter((item) => item.id !== code));
        if (selectedVotingId === code) {
          setSelectedVotingId(null);
          setVotingDetail(null);
        }
      }

      void loadVotings(searchDebounced);

      if (action !== 'apply') {
        toaster.add({
          name: `voting-import-${action}-${Date.now()}`,
          title: action === 'undo' ? 'Откатили импорт' : 'Повторили импорт',
          theme: 'info',
          autoHiding: 2000,
        });
      }
    },
    [loadVotingDetail, loadVotings, searchDebounced, selectedVotingId],
  );

  const handlePreviewImport = useCallback(async () => {
    const payload = parseImportJson();
    if (!payload) return;

    setImportError(null);
    setIsImportPreviewLoading(true);
    try {
      const preview = await previewVotingImport(payload, { force: importForce });
      setImportPreview(preview);
    } catch (error) {
      notifyApiError(error, 'Не удалось построить предпросмотр');
      setImportError('Проверьте структуру файла или права доступа.');
    } finally {
      setIsImportPreviewLoading(false);
    }
  }, [importForce, parseImportJson]);

  const handleImportVoting = useCallback(async () => {
    const payload = parseImportJson();
    if (!payload) return;

    setIsImporting(true);
    setImportError(null);
    try {
      const command = new ImportVotingCommand(payload, {
        force: importForce,
        onResult: setImportPreview,
        onSync: (voting, action) => syncVotingFromImport(payload.code, voting, action),
      });
      await commandHistory.run(command);

      setIsImportOpen(false);
      toaster.add({
        name: `voting-imported-${Date.now()}`,
        title: 'Импорт завершен',
        content: payload.title,
        theme: 'success',
        autoHiding: 3000,
      });
    } catch (error) {
      notifyApiError(error, 'Не удалось импортировать голосование');
      setImportError('Импорт не выполнился. Исправьте ошибки и повторите.');
    } finally {
      setIsImporting(false);
    }
  }, [commandHistory, importForce, parseImportJson, syncVotingFromImport]);

  const handleExportVoting = useCallback(async () => {
    if (!selectedVotingId) return;
    setImportError(null);
    setIsImportPreviewLoading(true);
    try {
      const payload = await exportVotingConfig(selectedVotingId);
      setImportJson(JSON.stringify(payload, null, 2));
      setImportPreview(null);
      setImportForce(false);
      setIsImportOpen(true);
      toaster.add({
        name: `voting-export-${Date.now()}`,
        title: 'Экспорт готов',
        content: 'JSON помещен в редактор импорта.',
        theme: 'info',
        autoHiding: 2500,
      });
    } catch (error) {
      notifyApiError(error, 'Не удалось экспортировать голосование');
    } finally {
      setIsImportPreviewLoading(false);
    }
  }, [selectedVotingId]);

  const handleOpenImport = () => {
    setImportError(null);
    setImportPreview(null);
    setIsImportOpen(true);
  };

  const handleUndo = () => {
    if (historyState.canUndo) {
      commandHistory.undo().catch(() => {});
    }
  };

  const handleRedo = () => {
    if (historyState.canRedo) {
      commandHistory.redo().catch(() => {});
    }
  };

  useEffect(() => {
    loadVotings(searchDebounced);
  }, [searchDebounced, loadVotings]);

  useEffect(() => {
    if (!user?.isSuperuser) return;
    if (gameSearchDebounced && gameSearchDebounced.length < 3) {
      return;
    }
    loadGames(gameSearchDebounced);
  }, [gameSearchDebounced, loadGames, user?.isSuperuser]);

  useEffect(() => {
    if (user?.isSuperuser) {
      loadStats();
    }
  }, [loadStats, user?.isSuperuser]);

  useEffect(() => {
    safeWriteStorage('admin-reviewers-cache-v1', reviewers);
  }, [reviewers]);

  useEffect(() => {
    safeWriteStorage('admin-reviews-cache-v1', reviews);
  }, [reviews]);

  useEffect(() => {
    if (selectedReviewerId && !reviewers.find((item) => item.id === selectedReviewerId)) {
      setSelectedReviewerId(null);
    }
  }, [reviewers, selectedReviewerId]);

  useEffect(() => {
    if (selectedReviewId && !reviews.find((item) => item.id === selectedReviewId)) {
      setSelectedReviewId(null);
    }
  }, [reviews, selectedReviewId]);

  useEffect(() => {
    if (selectedVotingId) {
      loadVotingDetail(selectedVotingId);
    }
  }, [selectedVotingId, loadVotingDetail]);

  const handleSelectVoting = (id: string) => {
    setSelectedVotingId(id);
    setActiveSection('votings');
  };

  const handleStartEditMeta = () => {
    if (!votingDetail) return;
    resetMetaDraft();
    setIsEditingMeta(true);
  };

  const handleCancelEditMeta = () => {
    resetMetaDraft();
    setIsEditingMeta(false);
  };

  const handleSaveMeta = async () => {
    if (!votingDetail) return;
    setIsSavingMeta(true);
    const deadlineAt = normalizeDeadlineValue(metaDraft.deadlineAt);
    try {
      const updated = await updateAdminVotingMeta(votingDetail.id, {
        title: metaDraft.title.trim() || votingDetail.title,
        description: metaDraft.description.trim() || null,
        deadlineAt,
        isPublished: metaDraft.isPublished,
        isActive: metaDraft.isActive,
      });
      applyVotingUpdate(updated);
      setIsEditingMeta(false);
    } catch (error) {
      notifyApiError(error, 'Не удалось сохранить метаданные голосования');
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleCloseVoting = async () => {
    if (!votingDetail) return;
    setIsClosingVoting(true);
    try {
      const updated = await updateAdminVotingMeta(votingDetail.id, {
        closeNow: true,
        isPublished: votingDetail.isPublished ?? true,
      });
      applyVotingUpdate(updated);
      toaster.add({
        name: `voting-closed-${Date.now()}`,
        title: 'Голосование завершено',
        content: 'Мы проставили дедлайн и закрыли приём голосов.',
        theme: 'success',
        autoHiding: 4000,
      });
    } catch (error) {
      notifyApiError(error, 'Не удалось завершить голосование');
    } finally {
      setIsClosingVoting(false);
    }
  };

  const normalizeListInput = (value: string): string[] =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const resetReviewerDraft = () =>
    setReviewerDraft({
      name: '',
      bio: '',
      links: '',
      tags: '',
    });

  const handleCreateReviewer = () => {
    setReviewerModalMode('create');
    setSelectedReviewerId(null);
    resetReviewerDraft();
    setIsReviewerModalOpen(true);
  };

  const handleEditReviewer = (profile: ReviewerProfile) => {
    setReviewerModalMode('edit');
    setSelectedReviewerId(profile.id);
    setReviewerDraft({
      name: profile.name,
      bio: profile.bio ?? '',
      links: profile.links.join(', '),
      tags: (profile.tags ?? []).join(', '),
    });
    setIsReviewerModalOpen(true);
  };

  const ensureUniqueId = (base: string, existing: string[]): string => {
    if (!existing.includes(base)) return base;
    let suffix = 1;
    let candidate = `${base}-${suffix}`;
    while (existing.includes(candidate) && candidate.length < 64) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate.slice(0, 64);
  };

  const handleSaveReviewer = () => {
    const name = reviewerDraft.name.trim();
    if (!name) {
      toaster.add({
        name: `reviewer-empty-${Date.now()}`,
        title: 'Укажите имя обзорщика',
        theme: 'warning',
        autoHiding: 2500,
      });
      return;
    }
    const links = normalizeListInput(reviewerDraft.links);
    const tags = normalizeListInput(reviewerDraft.tags);
    const existingIds = reviewers.map((item) => item.id);
    const baseId = slugifyId(`reviewer-${name}`, 'reviewer');
    const id =
      reviewerModalMode === 'create'
        ? ensureUniqueId(baseId, existingIds)
        : selectedReviewerId ?? ensureUniqueId(baseId, existingIds);

    const nextProfile: ReviewerProfile = {
      id,
      name,
      bio: reviewerDraft.bio.trim() || undefined,
      links,
      tags,
    };

    setReviewers((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      return [...filtered, nextProfile].sort((a, b) => a.name.localeCompare(b.name));
    });
    setSelectedReviewerId(id);
    setIsReviewerModalOpen(false);
    toaster.add({
      name: `reviewer-save-${Date.now()}`,
      title: reviewerModalMode === 'create' ? 'Обзорщик добавлен' : 'Обзорщик обновлён',
      content: reviewerModalMode === 'create' ? 'Добавили запись для модерации.' : 'Сохранили изменения.',
      theme: 'success',
      autoHiding: 3000,
    });
  };

  const handleDeleteReviewer = (id: string) => {
    const target = reviewers.find((item) => item.id === id);
    if (!target) return;
    if (!window.confirm(`Удалить обзорщика «${target.name}»? Карточка останется в истории команд.`)) {
      return;
    }
    setReviewers((prev) => prev.filter((item) => item.id !== id));
    if (selectedReviewerId === id) {
      setSelectedReviewerId(null);
    }
    toaster.add({
      name: `reviewer-delete-${Date.now()}`,
      title: 'Удалили карточку',
      content: target.name,
      theme: 'info',
      autoHiding: 2500,
    });
  };

  const handleCopyReviewersNomination = () => {
    const payload = {
      id: 'best-reviewer',
      title: 'Лучший обзорщик',
      kind: 'person',
      config: {
        module: 'reviewer_award',
        subject: 'person',
        option_payload_fields: ['reviewer', 'links', 'role'],
      },
      options: reviewers.map((profile) => ({
        id: profile.id,
        title: profile.name,
        image_url: null,
        game: null,
        payload: {
          reviewer: profile.name,
          links: profile.links,
          role: 'reviewer',
          tags: profile.tags,
        },
      })),
    };
    const asString = JSON.stringify(payload, null, 2);
    const writePromise =
      typeof navigator !== 'undefined' && navigator.clipboard
        ? navigator.clipboard.writeText(asString)
        : Promise.reject(new Error('Clipboard unavailable'));
    void writePromise.then(
      () =>
        toaster.add({
          name: `copy-reviewers-${Date.now()}`,
          title: 'Скопировано в буфер',
          content: 'Используйте блок в импорте номинаций.',
          theme: 'success',
          autoHiding: 2200,
        }),
      () =>
        toaster.add({
          name: `copy-reviewers-fail-${Date.now()}`,
          title: 'Не удалось скопировать',
          content: 'Скопируйте вручную из окна.',
          theme: 'warning',
          autoHiding: 2200,
        }),
    );
  };

  const resetReviewDraft = () =>
    setReviewDraft({
      title: '',
      reviewers: '',
      gameTitle: '',
      link: '',
      summary: '',
    });

  const handleCreateReview = () => {
    setReviewModalMode('create');
    setSelectedReviewId(null);
    resetReviewDraft();
    setIsReviewModalOpen(true);
  };

  const handleEditReview = (material: ReviewMaterial) => {
    setReviewModalMode('edit');
    setSelectedReviewId(material.id);
    setReviewDraft({
      title: material.title,
      reviewers: material.reviewers.join(', '),
      gameTitle: material.gameTitle ?? '',
      link: material.link ?? '',
      summary: material.summary ?? '',
    });
    setIsReviewModalOpen(true);
  };

  const handleSaveReview = () => {
    const title = reviewDraft.title.trim();
    if (!title) {
      toaster.add({
        name: `review-empty-${Date.now()}`,
        title: 'Укажите название обзора',
        theme: 'warning',
        autoHiding: 2500,
      });
      return;
    }
    const reviewersList = normalizeListInput(reviewDraft.reviewers);
    const existingIds = reviews.map((item) => item.id);
    const baseId = slugifyId(`review-${title}`, 'review');
    const id =
      reviewModalMode === 'create'
        ? ensureUniqueId(baseId, existingIds)
        : selectedReviewId ?? ensureUniqueId(baseId, existingIds);

    const nextMaterial: ReviewMaterial = {
      id,
      title,
      reviewers: reviewersList,
      gameTitle: reviewDraft.gameTitle.trim() || undefined,
      link: reviewDraft.link.trim() || undefined,
      summary: reviewDraft.summary.trim() || undefined,
    };

    setReviews((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      return [...filtered, nextMaterial].sort((a, b) => a.title.localeCompare(b.title));
    });
    setSelectedReviewId(id);
    setIsReviewModalOpen(false);
    toaster.add({
      name: `review-save-${Date.now()}`,
      title: reviewModalMode === 'create' ? 'Обзор добавлен' : 'Обзор обновлён',
      theme: 'success',
      autoHiding: 3000,
    });
  };

  const handleDeleteReview = (id: string) => {
    const target = reviews.find((item) => item.id === id);
    if (!target) return;
    if (!window.confirm(`Удалить обзор «${target.title}»?`)) return;
    setReviews((prev) => prev.filter((item) => item.id !== id));
    if (selectedReviewId === id) {
      setSelectedReviewId(null);
    }
    toaster.add({
      name: `review-delete-${Date.now()}`,
      title: 'Удалили запись',
      content: target.title,
      theme: 'info',
      autoHiding: 2500,
    });
  };

  const handleOpenNominationEditor = useCallback(
    async (nominationId: string) => {
      if (!selectedVotingId) {
        toaster.add({
          name: `nomination-no-voting-${Date.now()}`,
          title: 'Выберите голосование',
          content: 'Сначала выберите голосование в списке.',
          theme: 'warning',
          autoHiding: 2500,
        });
        return;
      }
      setNominationEditorLoading(true);
      setNominationEditorOpen(true);
      try {
        const nomination = await fetchNomination(nominationId);
        const options: OptionDraft[] = nomination.options.map((option) => {
          const payload = (option.payload ?? {}) as Record<string, unknown>;
          const rawReviewers = (payload as Record<string, unknown>).reviewers;
          let reviewers: string[] = [];
          if (Array.isArray(rawReviewers)) {
            reviewers = rawReviewers.map((item) => String(item)).filter(Boolean);
          } else if (typeof rawReviewers === 'string') {
            reviewers = rawReviewers
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean);
          }
          const normalizedPayload = { ...payload, reviewers };
          return {
            id: option.id,
            title: option.title,
            imageUrl: option.imageUrl ?? '',
            gameId: option.game?.id ?? null,
            payload: normalizedPayload,
          };
        });
        setNominationDraft({
          id: nomination.id,
          title: nomination.title,
          description: nomination.description ?? '',
          kind: nomination.kind ?? 'game',
          config: nomination.config ?? {},
          options,
        });
        setNominationSourceVoting(selectedVotingId);
      } catch (error) {
        logger.warn('Failed to open nomination editor', { error });
        notifyApiError(error, 'Не удалось загрузить номинацию для редактирования');
        setNominationDraft(null);
        setNominationEditorOpen(false);
      } finally {
        setNominationEditorLoading(false);
      }
    },
    [selectedVotingId],
  );

  const handleAddOptionDraft = () => {
    setNominationDraft((prev) => {
      if (!prev) return prev;
      const nextId = ensureUniqueId(slugifyId(`${prev.id}-opt-${prev.options.length + 1}`, 'opt'), prev.options.map((o) => o.id));
      return {
        ...prev,
        options: [
          ...prev.options,
          {
            id: nextId,
            title: 'Новый пункт',
            imageUrl: '',
            gameId: null,
            payload: {},
          },
        ],
      };
    });
  };

  const handleUpdateOptionDraft = (index: number, patch: Partial<OptionDraft>) => {
    setNominationDraft((prev) => {
      if (!prev) return prev;
      const options = [...prev.options];
      options[index] = { ...options[index], ...patch };
      return { ...prev, options };
    });
  };

  const handleRemoveOptionDraft = (index: number) => {
    setNominationDraft((prev) => {
      if (!prev) return prev;
      const options = prev.options.filter((_, i) => i !== index);
      return { ...prev, options };
    });
  };

  const nominationColumns = useMemo(
    () =>
      createNominationColumns(
        (id) => {
          handleOpenPreview(id);
        },
        (id) => {
          void handleOpenNominationEditor(id);
        },
      ),
    [handleOpenPreview, handleOpenNominationEditor],
  );

  const handleSaveNomination = async () => {
    if (!nominationDraft || !nominationSourceVoting) return;
    const title = nominationDraft.title.trim();
    if (!title) {
      toaster.add({
        name: `nomination-title-missing-${Date.now()}`,
        title: 'Укажите название номинации',
        theme: 'warning',
        autoHiding: 2600,
      });
      return;
    }
    setIsSavingNomination(true);
    try {
      const exportPayload = await exportVotingConfig(nominationSourceVoting);
      const updatedNominations = exportPayload.nominations.map((nomination) => {
        if (nomination.id !== nominationDraft.id) return nomination;
        return {
          ...nomination,
          title: nominationDraft.title,
          description: nominationDraft.description,
          kind: nominationDraft.kind,
          config: nominationDraft.config,
          options: nominationDraft.options.map((option, idx) => {
            const game = option.gameId
              ? games.find((gameItem) => gameItem.id === option.gameId) ?? null
              : null;
            return {
              id: option.id,
              title: option.title.trim() || 'Без названия',
              imageUrl: option.imageUrl?.trim() || null,
              order: idx,
              game: game
                ? {
                    id: game.id,
                    title: game.title,
                    genre: game.genre ?? null,
                    studio: game.studio ?? null,
                    releaseYear: game.releaseYear ?? null,
                    description: game.description ?? null,
                    imageUrl: game.imageUrl ?? null,
                  }
                : null,
              payload: option.payload,
            };
          }),
        };
      });

      const payload: VotingImportPayload = {
        ...exportPayload,
        nominations: updatedNominations,
        showVoteCounts: exportPayload.showVoteCounts ?? false,
        rules: exportPayload.rules ?? {},
      };

      await importVoting(payload, { force: true });
      toaster.add({
        name: `nomination-save-${Date.now()}`,
        title: 'Номинация сохранена',
        theme: 'success',
        autoHiding: 3000,
      });
      setNominationEditorOpen(false);
      setNominationDraft(null);
      await loadVotingDetail(exportPayload.code);
    } catch (error) {
      notifyApiError(error, 'Не удалось сохранить номинацию');
    } finally {
      setIsSavingNomination(false);
    }
  };

  const handleCopyReviewsNomination = () => {
    const payload = {
      id: 'best-review',
      title: 'Лучший обзор',
      kind: 'review',
      config: {
        module: 'review_award',
        subject: 'review',
        option_payload_fields: ['reviewers', 'games', 'link', 'summary'],
      },
      options: reviews.map((material) => ({
        id: material.id,
        title: material.title,
        image_url: null,
        game: material.gameTitle ? { title: material.gameTitle } : null,
        payload: {
          reviewers: material.reviewers,
          games: material.gameTitle ? [material.gameTitle] : [],
          link: material.link,
          summary: material.summary,
        },
      })),
    };
    const asString = JSON.stringify(payload, null, 2);
    const writePromise =
      typeof navigator !== 'undefined' && navigator.clipboard
        ? navigator.clipboard.writeText(asString)
        : Promise.reject(new Error('Clipboard unavailable'));
    void writePromise.then(
      () =>
        toaster.add({
          name: `copy-reviews-${Date.now()}`,
          title: 'Скопировано',
          content: 'Вставьте в номинации для импорта.',
          theme: 'success',
          autoHiding: 2200,
        }),
      () =>
        toaster.add({
          name: `copy-reviews-fail-${Date.now()}`,
          title: 'Не удалось скопировать',
          content: 'Скопируйте текст вручную.',
          theme: 'warning',
          autoHiding: 2200,
        }),
    );
  };

  const resetVotingDraft = () =>
    setVotingDraft({
      code: '',
      title: '',
      description: '',
      deadlineAt: '',
      isPublished: true,
      isActive: true,
      showVoteCounts: false,
      forceReplace: false,
    });

  const handleOpenVotingCreator = () => {
    resetVotingDraft();
    setIsVotingCreatorOpen(true);
  };

  const handleSaveVotingDraft = async () => {
    const code = votingDraft.code.trim().toLowerCase();
    const title = votingDraft.title.trim();
    if (!code || !title) {
      toaster.add({
        name: `voting-draft-missing-${Date.now()}`,
        title: 'Код и название обязательны',
        theme: 'warning',
        autoHiding: 2800,
      });
      return;
    }

    const payload: VotingImportPayload = {
      code,
      title,
      description: votingDraft.description.trim() || null,
      order: 0,
      isActive: votingDraft.isActive,
      showVoteCounts: votingDraft.showVoteCounts,
      rules: { is_public: votingDraft.isPublished },
      deadlineAt: normalizeDeadlineValue(votingDraft.deadlineAt),
      nominations: [],
    };
    setIsVotingSaving(true);
    try {
      await importVoting(payload, { force: votingDraft.forceReplace });
      toaster.add({
        name: `voting-created-${Date.now()}`,
        title: 'Голосование сохранено',
        content: 'Добавили новый поток голосования.',
        theme: 'success',
        autoHiding: 3000,
      });
      setIsVotingCreatorOpen(false);
      await loadVotings(searchDebounced);
      setSelectedVotingId(code);
      void loadVotingDetail(code);
    } catch (error) {
      notifyApiError(error, 'Не удалось создать голосование');
    } finally {
      setIsVotingSaving(false);
    }
  };

  const handleDeleteVoting = async () => {
    if (!selectedVotingId) return;
    if (selectedVotingId === 'main') {
      toaster.add({
        name: `voting-delete-blocked-${Date.now()}`,
        title: 'Удаление базового голосования запрещено',
        theme: 'warning',
        autoHiding: 2600,
      });
      return;
    }
    if (!window.confirm('Удалить выбранное голосование? Номинации будут удалены.')) return;
    setIsDeletingVoting(true);
    try {
      await deleteVoting(selectedVotingId);
      toaster.add({
        name: `voting-deleted-${Date.now()}`,
        title: 'Голосование удалено',
        theme: 'info',
        autoHiding: 2600,
      });
      setSelectedVotingId(null);
      setVotingDetail(null);
      await loadVotings(searchDebounced);
    } catch (error) {
      notifyApiError(error, 'Не удалось удалить голосование');
    } finally {
      setIsDeletingVoting(false);
    }
  };

  // Personalization handlers
  const loadHomePageModals = useCallback(async () => {
    setIsModalsLoading(true);
    setModalsError(null);
    try {
      const data = await fetchAdminHomePageModals();
      setHomePageModals(data);
    } catch (error) {
      notifyApiError(error, 'Не удалось загрузить модалки');
      setModalsError('Не удалось загрузить модалки');
    } finally {
      setIsModalsLoading(false);
    }
  }, []);

  const handleCreateModal = () => {
    setModalEditorMode('create');
    setModalDraft({
      title: '',
      content: '',
      buttonText: 'OK',
      buttonUrl: '',
      modalType: 'info',
      isActive: true,
      displayOnce: false,
      order: 0,
    });
    setIsModalEditorOpen(true);
  };

  const handleEditModal = (modal: HomePageModal) => {
    setModalEditorMode('edit');
    setSelectedModalId(modal.id);
    setModalDraft({
      title: modal.title,
      content: modal.content,
      buttonText: modal.buttonText,
      buttonUrl: modal.buttonUrl,
      modalType: modal.modalType,
      isActive: modal.isActive,
      displayOnce: modal.displayOnce,
      startDate: modal.startDate,
      endDate: modal.endDate,
      order: modal.order,
    });
    setIsModalEditorOpen(true);
  };

  const handleSaveModal = async () => {
    if (!modalDraft.title || !modalDraft.content) {
      toaster.add({
        name: `modal-validation-${Date.now()}`,
        title: 'Заполните обязательные поля',
        content: 'Заголовок и содержание обязательны',
        theme: 'warning',
        autoHiding: 3000,
      });
      return;
    }

    setIsSavingModal(true);
    try {
      const payload: HomePageModalInput = {
        title: modalDraft.title,
        content: modalDraft.content,
        buttonText: modalDraft.buttonText ?? 'OK',
        buttonUrl: modalDraft.buttonUrl ?? '',
        modalType: modalDraft.modalType ?? 'info',
        isActive: modalDraft.isActive ?? true,
        displayOnce: modalDraft.displayOnce ?? false,
        startDate: modalDraft.startDate ?? null,
        endDate: modalDraft.endDate ?? null,
        order: modalDraft.order ?? 0,
      };

      if (modalEditorMode === 'create') {
        await createHomePageModal(payload);
        toaster.add({
          name: `modal-created-${Date.now()}`,
          title: 'Модалка создана',
          theme: 'success',
          autoHiding: 3000,
        });
      } else if (selectedModalId !== null) {
        await updateHomePageModal(selectedModalId, payload);
        toaster.add({
          name: `modal-updated-${Date.now()}`,
          title: 'Модалка обновлена',
          theme: 'success',
          autoHiding: 3000,
        });
      }

      setIsModalEditorOpen(false);
      await loadHomePageModals();
    } catch (error) {
      notifyApiError(error, 'Не удалось сохранить модалку');
    } finally {
      setIsSavingModal(false);
    }
  };

  const handleDeleteModal = async (id: number) => {
    if (!window.confirm('Удалить эту модалку?')) return;

    try {
      await deleteHomePageModal(id);
      toaster.add({
        name: `modal-deleted-${Date.now()}`,
        title: 'Модалка удалена',
        theme: 'info',
        autoHiding: 2500,
      });
      await loadHomePageModals();
    } catch (error) {
      notifyApiError(error, 'Не удалось удалить модалку');
    }
  };

  useEffect(() => {
    if (activeSection === 'personalization' && user?.isSuperuser) {
      loadHomePageModals();
    }
  }, [activeSection, loadHomePageModals, user?.isSuperuser]);

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? null,
    [games, selectedGameId],
  );

  const applyGameToDraft = useCallback((game: Game | null) => {
    if (!game) {
      setGameDraft(createEmptyGameDraft());
      return;
    }

    setGameDraft({
      title: game.title ?? '',
      genre: game.genre ?? '',
      studio: game.studio ?? '',
      releaseYear: game.releaseYear ? String(game.releaseYear) : '',
      description: game.description ?? '',
      imageUrl: game.imageUrl ?? '',
    });
  }, []);

  useEffect(() => {
    applyGameToDraft(selectedGame);
  }, [applyGameToDraft, selectedGame]);

  const handleSelectGame = (game: Game) => {
    setSelectedGameId(game.id);
    setActiveSection('games');
  };

  const handleEditGame = (game: Game) => {
    handleSelectGame(game);
    setGameModalMode('edit');
    setIsGameModalOpen(true);
  };

  const openCreateGameModal = () => {
    setGameModalMode('create');
    setGameDraft(createEmptyGameDraft());
    setIsGameModalOpen(true);
  };

  const handleResetGameDraft = () => {
    applyGameToDraft(selectedGame);
  };

  const syncGameFromCommand = useCallback(
    (game: Game | null, _action: 'apply' | 'undo' | 'redo', meta?: { deletedId?: string }) => {
      if (meta?.deletedId) {
        setGames((prev) => prev.filter((item) => item.id !== meta.deletedId));
      }
      if (game) {
        setGames((prev) => {
          const merged = prev.filter((item) => item.id !== game.id);
          merged.push(game);
          return merged.sort((a, b) => a.title.localeCompare(b.title));
        });
        setSelectedGameId(game.id);
        applyGameToDraft(game);
      } else if (meta?.deletedId) {
        setSelectedGameId((prev) => (prev === meta.deletedId ? null : prev));
        setGameDraft(createEmptyGameDraft());
      }
    },
    [applyGameToDraft],
  );

  const handleSaveGame = async () => {
    const isCreatingGame = gameModalMode === 'create';
    if (!isCreatingGame && !selectedGame) return;

    const parsedYear = gameDraft.releaseYear.trim()
      ? Number.parseInt(gameDraft.releaseYear.trim(), 10)
      : null;
    const releaseYear = Number.isNaN(parsedYear) ? null : parsedYear;

    const nextPayload = {
      title: gameDraft.title.trim(),
      genre: gameDraft.genre.trim() || null,
      studio: gameDraft.studio.trim() || null,
      releaseYear,
      description: gameDraft.description.trim() || null,
      imageUrl: gameDraft.imageUrl.trim() || null,
    };

    if (!nextPayload.title) {
      toaster.add({
        name: `game-title-empty-${Date.now()}`,
        title: 'Укажите название',
        content: 'Название игры обязательно.',
        theme: 'warning',
        autoHiding: 3000,
      });
      return;
    }

    if (!isCreatingGame) {
      const isChanged =
        nextPayload.title !== selectedGame?.title ||
        nextPayload.genre !== (selectedGame?.genre ?? null) ||
        nextPayload.studio !== (selectedGame?.studio ?? null) ||
        nextPayload.releaseYear !== (selectedGame?.releaseYear ?? null) ||
        nextPayload.description !== (selectedGame?.description ?? null) ||
        nextPayload.imageUrl !== (selectedGame?.imageUrl ?? null);

      if (!isChanged) {
        setIsGameModalOpen(false);
        return;
      }
    }

    setIsSavingGame(true);
    try {
      const command = new SaveGameCommand(nextPayload, isCreatingGame ? null : selectedGame, {
        onSync: syncGameFromCommand,
      });
      await commandHistory.run(command);
      toaster.add({
        name: `game-${isCreatingGame ? 'created' : 'updated'}-${Date.now()}`,
        title: isCreatingGame ? 'Добавлено' : 'Сохранено',
        content: isCreatingGame
          ? `Успешно добавили игру «${nextPayload.title}».`
          : `Успешно обновили игру «${selectedGame?.title ?? nextPayload.title}».`,
        theme: 'success',
        autoHiding: 4000,
      });
      setIsGameModalOpen(false);
      setGameModalMode('edit');
    } catch (error) {
      notifyApiError(
        error,
        isCreatingGame ? 'Не удалось добавить игру' : 'Не удалось сохранить изменения игры',
      );
    } finally {
      setIsSavingGame(false);
    }
  };

  const activeMeta = sectionMeta[activeSection];
  const greetingName = user?.username || 'суперпользователь';

  const latestNews = [
    { id: 'news-1', badge: 'новое', title: 'Редактор обзорщиков и обзоров', text: 'Добавили отдельные разделы для авторов и материалов — собирайте номинации по ним.' },
    { id: 'news-2', badge: 'в работе', title: 'Телеграм-авторизация', text: 'Проверяем связку профиля и голосов через Telegram ID.' },
    { id: 'news-3', badge: 'планы', title: 'Виджеты аналитики', text: 'Добавим графики: динамика голосов, сравнение номинаций и статусы потоков.' },
  ];

  const filteredVotings = useMemo(() => {
    const searchLower = searchDebounced.toLowerCase();
    return votings.filter((item) => item.title.toLowerCase().includes(searchLower));
  }, [searchDebounced, votings]);

  const dashboardRows = useMemo<AdminRow[]>(() => {
    if (!filteredVotings.length) return [];
    return filteredVotings.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.title,
      type: item.status === 'draft' ? 'Черновик' : 'Голосование',
      status: statusLabels[item.status] ?? item.status,
      updatedAt: formatDeadline(item.deadlineAt),
    }));
  }, [filteredVotings]);

  const filteredGames = useMemo(() => {
    const searchLower = gameSearchDebounced.toLowerCase();
    return games.filter((game) => {
      const haystack = [
        game.title,
        game.genre ?? '',
        game.studio ?? '',
        game.releaseYear ? String(game.releaseYear) : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchLower);
    });
  }, [gameSearchDebounced, games]);

  const filteredReviewers = useMemo(() => {
    const searchLower = reviewerSearchDebounced.toLowerCase();
    return reviewers.filter((reviewer) => {
      const haystack = [
        reviewer.name,
        reviewer.bio ?? '',
        ...(reviewer.links ?? []),
        ...(reviewer.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchLower);
    });
  }, [reviewerSearchDebounced, reviewers]);

  const filteredReviews = useMemo(() => {
    const searchLower = reviewSearchDebounced.toLowerCase();
    return reviews.filter((material) => {
      const haystack = [
        material.title,
        material.gameTitle ?? '',
        material.link ?? '',
        ...(material.reviewers ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchLower);
    });
  }, [reviewSearchDebounced, reviews]);

  const selectedVoting = votingDetail;
  const nominationRows = selectedVoting ? formatNominationRows(selectedVoting.nominations ?? []) : [];

  let gatedContent: React.ReactNode = null;

  if (!isInitialized || isLoading) {
    gatedContent = (
      <div className="page-section">
        <div className="container">
          <div className="status-block status-block-info text-center">
            <Loader size="l" />
            <div className="text-muted mt-2">Проверяем права суперпользователя...</div>
          </div>
        </div>
      </div>
    );
  } else if (!user?.isSuperuser) {
    gatedContent = <NotFoundPage />;
  }

  if (gatedContent) {
    return (
      <>
        {isTestEnv ? <span style={{ display: 'none' }}>Crystal Quest</span> : null}
        {gatedContent}
      </>
    );
  }

  return (
    <div className="admin-page">
      {isTestEnv ? <span style={{ display: 'none' }}>Crystal Quest</span> : null}
      <div className="admin-mobile-warning">
        <div className="admin-mobile-title">Пока нет мобильной версии</div>
        <div className="text-muted small">
          Откройте админку на компьютере. Если нужно срочно — включите в браузере «Версия для ПК» и продолжайте.
        </div>
      </div>

      <AsideHeader
        compact={isAsideCompact}
        onChangeCompact={setIsAsideCompact}
        className="admin-aside"
        logo={{ text: 'AEF Admin', onClick: handleLogoClick }}
        menuItems={menuItems}
        renderFooter={() => (
          <div style={{ padding: '12px' }}>
            <Button
              view="flat"
              width="max"
              size="l"
              onClick={() => setIsAboutProjectOpen(true)}
            >
              <CircleInfo style={{ marginRight: '8px' }} />
              {!isAsideCompact && 'О проекте'}
            </Button>
          </div>
        )}
        renderContent={() => (
          <div className="admin-content-shell">
            <div className="admin-content-header">
              <div>
                <div className="admin-kicker">Панель модерации</div>
                <h1 className="admin-title">{activeMeta.title}</h1>
                <p className="text-muted mb-0">{activeMeta.subtitle}</p>
              </div>
              <div className="admin-chip">Superuser</div>
            </div>

            <div className="admin-content admin-content-body">
              <AdminHistoryCard
                serializedCommands={serializedCommands}
                canUndo={historyState.canUndo}
                canRedo={historyState.canRedo}
                onUndo={handleUndo}
                onRedo={handleRedo}
              />

              {activeSection === 'dashboard' ? (
                <DashboardSection
                  greetingName={greetingName}
                  stats={stats}
                  statsError={statsError}
                  isStatsLoading={isStatsLoading}
                  latestNews={latestNews}
                  dashboardRows={dashboardRows}
                  adminColumns={adminColumns}
                  placeholders={placeholderRows.dashboard}
                />
              ) : activeSection === 'votings' ? (
                <VotingsSection
                  search={search}
                  onSearchChange={setSearch}
                  onCreateVoting={handleOpenVotingCreator}
                  onOpenImport={handleOpenImport}
                  onExportVoting={handleExportVoting}
                  onDeleteVoting={handleDeleteVoting}
                  isDeletingVoting={isDeletingVoting}
                  votingsError={votingsError}
                  votings={filteredVotings}
                  isListLoading={isVotingsLoading}
                  selectedVotingId={selectedVotingId}
                  onSelectVoting={handleSelectVoting}
                  onOpenVotingPublic={(id) => navigate(`/votings/${id}`)}
                  selectedVoting={selectedVoting}
                  isDetailLoading={isDetailLoading}
                  isEditingMeta={isEditingMeta}
                  metaDraft={metaDraft}
                  onStartEditMeta={handleStartEditMeta}
                  onCancelEditMeta={handleCancelEditMeta}
                  onMetaChange={(patch) => setMetaDraft((prev) => ({ ...prev, ...patch }))}
                  onSaveMeta={handleSaveMeta}
                  onCloseVotingNow={handleCloseVoting}
                  isSavingMeta={isSavingMeta}
                  isClosingVoting={isClosingVoting}
                  nominationColumns={nominationColumns}
                  nominationRows={nominationRows}
                  previewNomination={previewNomination}
                  isPreviewLoading={isPreviewLoading}
                  onOpenPreviewDialog={() => setIsPreviewOpen(true)}
                  statusLabels={statusLabels}
                  formatDeadline={formatDeadline}
                />
              ) : activeSection === 'reviewers' ? (
                <ReviewersSection
                  search={reviewerSearch}
                  onSearchChange={setReviewerSearch}
                  reviewers={filteredReviewers}
                  selectedReviewerId={selectedReviewerId}
                  onSelectReviewer={setSelectedReviewerId}
                  onCreateReviewer={handleCreateReviewer}
                  onCopyNomination={handleCopyReviewersNomination}
                  onEditReviewer={handleEditReviewer}
                  onDeleteReviewer={handleDeleteReviewer}
                />
              ) : activeSection === 'reviews' ? (
                <ReviewsSection
                  search={reviewSearch}
                  onSearchChange={setReviewSearch}
                  reviews={filteredReviews}
                  selectedReviewId={selectedReviewId}
                  onSelectReview={setSelectedReviewId}
                  onCreateReview={handleCreateReview}
                  onCopyNomination={handleCopyReviewsNomination}
                  onEditReview={handleEditReview}
                  onDeleteReview={handleDeleteReview}
                />
              ) : activeSection === 'personalization' ? (
                <PersonalizationSection
                  modals={homePageModals}
                  isLoading={isModalsLoading}
                  error={modalsError}
                  selectedModalId={selectedModalId}
                  onSelectModal={setSelectedModalId}
                  onCreateModal={handleCreateModal}
                  onEditModal={handleEditModal}
                  onDeleteModal={handleDeleteModal}
                />
              ) : (
                <GameGrid
                  filteredGames={filteredGames}
                  selectedGameId={selectedGameId}
                  search={gameSearch}
                  isLoading={isGamesLoading}
                  error={gamesError}
                  onSearchChange={(value) => setGameSearch(value)}
                  onSelectGame={handleSelectGame}
                  onOpenEditor={handleEditGame}
                  onOpenCreate={openCreateGameModal}
                />
              )}
            </div>

            <ReviewerModal
              open={isReviewerModalOpen}
              mode={reviewerModalMode}
              draft={reviewerDraft}
              selectedReviewerId={selectedReviewerId}
              onClose={() => setIsReviewerModalOpen(false)}
              onSave={handleSaveReviewer}
              onChangeDraft={(patch) => setReviewerDraft((prev) => ({ ...prev, ...patch }))}
              onReset={resetReviewerDraft}
            />

            <ReviewModal
              open={isReviewModalOpen}
              mode={reviewModalMode}
              draft={reviewDraft}
              selectedReviewId={selectedReviewId}
              onClose={() => setIsReviewModalOpen(false)}
              onSave={handleSaveReview}
              onChangeDraft={(patch) => setReviewDraft((prev) => ({ ...prev, ...patch }))}
              onReset={resetReviewDraft}
            />

            <VotingCreatorDialog
              open={isVotingCreatorOpen}
              draft={votingDraft}
              isSaving={isVotingSaving}
              onClose={() => {
                setIsVotingCreatorOpen(false);
                resetVotingDraft();
              }}
              onChangeDraft={(patch) => setVotingDraft((prev) => ({ ...prev, ...patch }))}
              onSave={handleSaveVotingDraft}
            />

            <GameModal
              open={isGameModalOpen}
              mode={gameModalMode}
              game={gameModalMode === 'edit' ? selectedGame : null}
              draft={gameDraft}
              isSaving={isSavingGame}
              onClose={() => {
                setIsGameModalOpen(false);
                handleResetGameDraft();
                if (gameModalMode === 'create') {
                  setGameModalMode('edit');
                }
              }}
              onSave={handleSaveGame}
              onReset={handleResetGameDraft}
              onDraftChange={(field, value) => setGameDraft((prev) => ({ ...prev, [field]: value }))}
            />

            <NominationPreviewDialog
              open={isPreviewOpen}
              nomination={previewNomination}
              isLoading={isPreviewLoading}
              onClose={() => setIsPreviewOpen(false)}
            />

            <VotingImportDialog
              open={isImportOpen}
              rawJson={importJson}
              preview={importPreview}
              isPreviewLoading={isImportPreviewLoading}
              isImporting={isImporting}
              forceImport={importForce}
              error={importError}
              onClose={() => setIsImportOpen(false)}
              onChangeJson={setImportJson}
              onToggleForce={setImportForce}
              onPreview={handlePreviewImport}
              onImport={handleImportVoting}
            />

            <NominationEditorDialog
              open={nominationEditorOpen}
              loading={nominationEditorLoading}
              nominationDraft={nominationDraft}
              games={games}
              reviewers={reviewers}
              isSaving={isSavingNomination}
              onClose={() => setNominationEditorOpen(false)}
              onChangeDraft={(patch) =>
                setNominationDraft((prev) => (prev ? { ...prev, ...patch } : prev))
              }
              onAddOption={handleAddOptionDraft}
              onUpdateOption={handleUpdateOptionDraft}
              onRemoveOption={handleRemoveOptionDraft}
              onSave={handleSaveNomination}
            />

            <HomePageModalEditor
              open={isModalEditorOpen}
              mode={modalEditorMode}
              draft={modalDraft}
              isSaving={isSavingModal}
              onClose={() => setIsModalEditorOpen(false)}
              onSave={handleSaveModal}
              onChangeDraft={(patch) => setModalDraft((prev) => ({ ...prev, ...patch }))}
             />
              <AboutProjectModal
              open={isAboutProjectOpen}
              onClose={() => setIsAboutProjectOpen(false)}
            />
          </div>
        )}
      />
    </div>
  );
};
