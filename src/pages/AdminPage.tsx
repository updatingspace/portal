import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AsideHeader, type MenuItem } from '@gravity-ui/navigation';
import {
  Button,
  Card,
  Icon,
  Loader,
  Table,
  TextInput,
  type TableColumnConfig,
} from '@gravity-ui/uikit';
import Pencil from '@gravity-ui/icons/Pencil';
import Gear from '@gravity-ui/icons/Gear';
import Magnifier from '@gravity-ui/icons/Magnifier';
import ArrowUpRightFromSquare from '@gravity-ui/icons/ArrowUpRightFromSquare';
import Cubes3 from '@gravity-ui/icons/Cubes3';
import ListCheck from '@gravity-ui/icons/ListCheck';

import {
  fetchAdminVotings,
  fetchAdminVoting,
  updateAdminVotingMeta,
  type AdminNomination,
  type AdminVoting,
  type AdminVotingListItem,
} from '../api/adminVotings';
import { createGame, fetchGames, updateGame } from '../api/games';
import { useAuth } from '../contexts/AuthContext';
import { NotFoundPage } from './NotFoundPage';
import type { Game } from '../types/games';
import { notifyApiError } from '../utils/apiErrorHandling';
import { fetchNomination } from '../api/nominations';
import type { Nomination } from '../data/nominations';
import { toaster } from '../toaster';
import { GameGrid } from '../components/admin/GameGrid';
import { GameModal } from '../components/admin/GameModal';
import { NominationPreviewDialog } from '../components/admin/NominationPreviewDialog';
import { NominationPreviewPanel } from '../components/admin/NominationPreviewPanel';

type AdminSection = 'dashboard' | 'games' | 'votings';

type AdminRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  updatedAt: string;
};

type NominationRow = {
  id: string;
  title: string;
  status: string;
  votes: string | number;
  updatedAt: string;
};

const createEmptyGameDraft = (): GameDraft => ({
  title: '',
  genre: '',
  studio: '',
  releaseYear: '',
  description: '',
  imageUrl: '',
});

type GameDraft = {
  title: string;
  genre: string;
  studio: string;
  releaseYear: string;
  description: string;
  imageUrl: string;
};

const adminColumns: TableColumnConfig<AdminRow>[] = [
  { id: 'title', name: 'Название' },
  { id: 'type', name: 'Раздел', width: 140 },
  { id: 'status', name: 'Статус', width: 160 },
  { id: 'updatedAt', name: 'Обновлено', width: 180 },
];

const createNominationColumns = (
  onPreview: (nominationId: string) => void,
): TableColumnConfig<NominationRow>[] => [
  { id: 'title', name: 'Номинация' },
  { id: 'status', name: 'Статус', width: 140 },
  { id: 'votes', name: 'Голосов', width: 120 },
  { id: 'updatedAt', name: 'Обновлено', width: 180 },
  {
    id: 'preview',
    name: 'Карточки',
    width: 130,
    className: 'admin-nomination-preview-column',
    template: (item) => (
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
];

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
};

const fallbackVotings: AdminVotingListItem[] = [
  {
    id: 'vote-1',
    title: 'AEF Game Jam · основной поток',
    description: 'Голосование по итоговым проектам Jam. Участники и судьи.',
    status: 'active',
    deadlineAt: '2025-03-01T18:00:00Z',
    nominationCount: 6,
  },
  {
    id: 'vote-2',
    title: 'Экспресс-опрос: любимые механики',
    description: 'Сбор обратной связи по механикам, быстрые выборы.',
    status: 'draft',
    deadlineAt: null,
    nominationCount: 3,
  },
  {
    id: 'vote-3',
    title: 'Архив 2024 · лучшие игры',
    description: 'Архивное голосование, только просмотр результатов.',
    status: 'archived',
    deadlineAt: '2024-12-01T18:00:00Z',
    nominationCount: 5,
  },
];

const fallbackVotingDetails: Record<string, AdminVoting> = {
  'vote-1': {
    ...fallbackVotings[0],
    nominations: [
      { id: 'n-1', title: 'Лучшая графика', status: 'active', votes: 120, updatedAt: '2025-02-10T12:00:00Z' },
      { id: 'n-2', title: 'Лучший геймплей', status: 'active', votes: 143, updatedAt: '2025-02-09T21:00:00Z' },
      { id: 'n-3', title: 'Инновации', status: 'draft', votes: null, updatedAt: null },
    ],
    isPublished: true,
  },
  'vote-2': {
    ...fallbackVotings[1],
    nominations: [
      { id: 'n-4', title: 'Механика платформера', status: 'draft', votes: null, updatedAt: null },
      { id: 'n-5', title: 'Метроидвания', status: 'draft', votes: null, updatedAt: null },
    ],
    isPublished: false,
  },
  'vote-3': {
    ...fallbackVotings[2],
    nominations: [
      { id: 'n-6', title: 'Визуал', status: 'archived', votes: 200, updatedAt: '2024-12-05T10:00:00Z' },
      { id: 'n-7', title: 'История', status: 'archived', votes: 180, updatedAt: '2024-12-05T10:00:00Z' },
    ],
    isPublished: false,
  },
};

const statusLabels: Record<string, string> = {
  active: 'Активно',
  draft: 'Черновик',
  archived: 'Архив',
};

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

const formatNominationRows = (items: AdminNomination[]): NominationRow[] =>
  items.map((item) => ({
    id: item.id,
    title: item.title,
    status: statusLabels[item.status] ?? item.status,
    votes: item.votes ?? '—',
    updatedAt: formatDate(item.updatedAt),
  }));

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isInitialized, isLoading, refreshProfile } = useAuth();

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
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState({ title: '', description: '' });
  const [gameSearch, setGameSearch] = useState('');
  const [gameSearchDebounced, setGameSearchDebounced] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [isGamesLoading, setIsGamesLoading] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [gameDraft, setGameDraft] = useState<GameDraft>(createEmptyGameDraft());
  const [isSavingGame, setIsSavingGame] = useState(false);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [gameModalMode, setGameModalMode] = useState<'edit' | 'create'>('edit');
  const [isAsideCompact, setIsAsideCompact] = useState(false);
  const [previewNomination, setPreviewNomination] = useState<Nomination | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      refreshProfile();
    }
  }, [isInitialized, refreshProfile]);

  const handleMenuItemClick = useCallback((item: MenuItem) => {
    if (item.id === 'games' || item.id === 'votings') {
      setActiveSection(item.id);
    }
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
  ], [activeSection, handleMenuItemClick]);

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
    [notifyApiError],
  );

  const nominationColumns = useMemo(
    () => createNominationColumns(handleOpenPreview),
    [handleOpenPreview],
  );

  const loadVotingDetail = useCallback(
    async (votingId: string) => {
      setIsDetailLoading(true);
      try {
        const detail = await fetchAdminVoting(votingId);
        setVotingDetail(detail);
        setMetaDraft({
          title: detail.title,
          description: detail.description ?? '',
        });
      } catch (error) {
        const fallbackDetail =
          fallbackVotingDetails[votingId] ??
          ({
            id: votingId,
            title: 'Черновик голосования',
            description: 'Заглушка деталки, API недоступно.',
            status: 'draft',
            deadlineAt: null,
            nominationCount: 0,
            nominations: [],
            isPublished: false,
          } satisfies AdminVoting);

        setVotingDetail(fallbackDetail);
        setMetaDraft({
          title: fallbackDetail.title,
          description: fallbackDetail.description ?? '',
        });
        setVotingsError('Не получилось получить детали из API, работаем с заглушкой.');
      } finally {
        setIsDetailLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadVotings(searchDebounced);
  }, [searchDebounced, loadVotings]);

  useEffect(() => {
    if (!user?.isSuperuser) return;
    loadGames(gameSearchDebounced);
  }, [gameSearchDebounced, loadGames, user?.isSuperuser]);

  useEffect(() => {
    if (selectedVotingId) {
      loadVotingDetail(selectedVotingId);
    }
  }, [selectedVotingId, loadVotingDetail]);

  const handleSelectVoting = (id: string) => {
    setSelectedVotingId(id);
    setActiveSection('votings');
  };

  const handleSaveMeta = async () => {
    if (!votingDetail) return;
    setIsSavingMeta(true);
    try {
      const updated = await updateAdminVotingMeta(votingDetail.id, {
        title: metaDraft.title.trim() || votingDetail.title,
        description: metaDraft.description.trim(),
      });
      setVotingDetail(updated);
      setVotings((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, title: updated.title, description: updated.description } : item)),
      );
      setIsEditingMeta(false);
    } catch (error) {
      notifyApiError(error, 'Не удалось сохранить метаданные голосования');
    } finally {
      setIsSavingMeta(false);
    }
  };

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? null,
    [games, selectedGameId],
  );

  const applyGameToDraft = (game: Game | null) => {
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
  };

  useEffect(() => {
    applyGameToDraft(selectedGame);
  }, [selectedGame]);

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
      const updated = isCreatingGame
        ? await createGame(nextPayload)
        : await updateGame(selectedGame!.id, nextPayload);

      setGames((prev) => {
        const merged = prev.filter((game) => game.id !== updated.id);
        merged.push(updated);
        return merged.sort((a, b) => a.title.localeCompare(b.title));
      });
      setSelectedGameId(updated.id);
      setGameDraft({
        title: updated.title,
        genre: updated.genre ?? '',
        studio: updated.studio ?? '',
        releaseYear: updated.releaseYear ? String(updated.releaseYear) : '',
        description: updated.description ?? '',
        imageUrl: updated.imageUrl ?? '',
      });
      toaster.add({
        name: `game-${isCreatingGame ? 'created' : 'updated'}-${Date.now()}`,
        title: isCreatingGame ? 'Добавлено' : 'Сохранено',
        content: isCreatingGame
          ? `Успешно добавили игру «${updated.title}».`
          : `Успешно обновили игру «${updated.title}».`,
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
    { id: 'news-1', badge: 'новое', title: 'Обновили витрину голосований', text: 'Главная страница подтянет живые данные — пока заглушки, скоро API.' },
    { id: 'news-2', badge: 'в работе', title: 'Телеграм-авторизация', text: 'Проверяем связку профиля и голосов через Telegram ID.' },
    { id: 'news-3', badge: 'планы', title: 'Виджеты аналитики', text: 'Добавим графики: динамика голосов, сравнение номинаций и статусы потоков.' },
  ];

  const filteredVotings = useMemo(() => {
    const searchLower = searchDebounced.toLowerCase();
    return votings.filter((item) => item.title.toLowerCase().includes(searchLower));
  }, [searchDebounced, votings]);

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
    return <>{gatedContent}</>;
  }

  return (
    <div className="admin-page">
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
              {activeSection === 'dashboard' ? (
                <>
                  <div className="admin-widget-grid">
                    <Card className="admin-card admin-greeting-card">
                      <div className="admin-card-title">Привет, {greetingName}!</div>
                      <p className="text-muted mb-2">
                        Здесь появятся персональные настройки обращения и роли. Пока используем ник из профиля.
                      </p>
                      <div className="admin-chip">Роль: Superuser</div>
                    </Card>

                    <Card className="admin-card">
                      <div className="admin-card-title">Кратко о статусе</div>
                      <p className="text-muted mb-0">
                        Страницы админки собираем на Gravity UI. Данные пока заглушки, подключим API Django позже.
                      </p>
                    </Card>
                  </div>

                  <Card className="admin-card">
                    <div className="admin-card-head">
                      <div>
                        <div className="admin-card-title">Последние новости</div>
                        <div className="text-muted small">
                          Данные пока статичны — API новостей добавим позже.
                        </div>
                      </div>
                    </div>
                    <div className="admin-news-list">
                      {latestNews.map((item) => (
                        <div key={item.id} className="admin-news-item">
                          <span className="admin-news-pill">{item.badge}</span>
                          <div className="admin-news-body">
                            <div className="admin-news-title">{item.title}</div>
                            <div className="text-muted small">{item.text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="admin-card">
                    <div className="admin-card-head">
                      <div>
                        <div className="admin-card-title">Активные голосования</div>
                        <div className="text-muted small">
                          Заглушка таблицы: подтянем реальные статусы и дедлайны из API.
                        </div>
                      </div>
                    </div>
                    <Table
                      columns={adminColumns}
                      data={placeholderRows.dashboard}
                      emptyMessage="Активных голосований нет."
                      getRowDescriptor={(row) => ({ id: row.id, classNames: ['admin-table-row'] })}
                      wordWrap
                      width="max"
                    />
                  </Card>
                </>
              ) : activeSection === 'votings' ? (
                <div className="admin-voting-layout">
                  <div className="admin-search-row">
                    <TextInput
                      size="l"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Умный поиск по названиям голосований"
                      startContent={<Icon data={Magnifier} size={16} />}
                      hasClear
                    />
                    {votingsError && <div className="text-warning small">{votingsError}</div>}
                  </div>

                  <div className="admin-voting-grid">
                    {isVotingsLoading ? (
                      <div className="admin-loader-box">
                        <Loader size="m" />
                        <div className="text-muted small">Подтягиваем голосования...</div>
                      </div>
                    ) : filteredVotings.length ? (
                      filteredVotings.map((item) => (
                        <Card
                          key={item.id}
                          className={
                            'admin-voting-card' + (selectedVotingId === item.id ? ' admin-voting-card-active' : '')
                          }
                          onClick={() => handleSelectVoting(item.id)}
                        >
                          <div className="admin-voting-card-top">
                            <span className={`admin-status admin-status-${item.status}`}>
                              {statusLabels[item.status] ?? item.status}
                            </span>
                            <span className="text-muted small">{formatDeadline(item.deadlineAt)}</span>
                          </div>
                          <div className="admin-voting-title">{item.title}</div>
                          <div className="text-muted admin-voting-desc">
                            {item.description ?? 'Добавьте описание, чтобы модераторы понимали контекст.'}
                          </div>
                          <div className="admin-voting-meta">
                            <span className="text-muted small">
                              Номинаций: {item.nominationCount}
                            </span>
                            <div className="admin-voting-actions">
                              <Button
                                size="s"
                                view="flat"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  navigate(`/votings/${item.id}`);
                                }}
                              >
                                <Icon data={ArrowUpRightFromSquare} size={14} /> Ознакомиться
                              </Button>
                              <Button
                                size="s"
                                view="outlined"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleSelectVoting(item.id);
                                }}
                              >
                                <Icon data={Gear} size={14} /> Настройки
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="status-block status-block-warning">
                        <div className="status-title">По запросу ничего не нашли</div>
                        <p className="text-muted mb-0">
                          Попробуйте изменить поисковый запрос или убрать фильтры.
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedVoting ? (
                    <Card className="admin-card admin-detail-card">
                      {isDetailLoading ? (
                        <div className="admin-loader-box">
                          <Loader size="m" />
                          <div className="text-muted small">Загружаем детали голосования...</div>
                        </div>
                      ) : (
                        <>
                          <div className="admin-detail-title-row">
                            {isEditingMeta ? (
                              <TextInput
                                size="l"
                                value={metaDraft.title}
                                onChange={(event) =>
                                  setMetaDraft((prev) => ({ ...prev, title: event.target.value }))
                                }
                                placeholder="Название голосования"
                              />
                            ) : (
                              <div className="admin-detail-title">{selectedVoting.title}</div>
                            )}
                            <Button
                              size="s"
                              view="flat-secondary"
                              onClick={() => {
                                setIsEditingMeta((prev) => !prev);
                                setMetaDraft({
                                  title: selectedVoting.title,
                                  description: selectedVoting.description ?? '',
                                });
                              }}
                            >
                              <Icon data={Pencil} size={14} /> {isEditingMeta ? 'Правим' : 'Редактировать'}
                            </Button>
                          </div>
                          <div className="text-muted small mb-2">
                            Дедлайн: {formatDeadline(selectedVoting.deadlineAt)} · Статус:{' '}
                            {statusLabels[selectedVoting.status] ?? selectedVoting.status}
                          </div>
                          {isEditingMeta ? (
                            <>
                              <textarea
                                className="admin-editable-textarea"
                                rows={4}
                                value={metaDraft.description}
                                onChange={(event) =>
                                  setMetaDraft((prev) => ({ ...prev, description: event.target.value }))
                                }
                                placeholder="Описание голосования"
                              />
                              <div className="admin-detail-actions">
                                <Button
                                  view="action"
                                  size="m"
                                  disabled={isSavingMeta}
                                  onClick={handleSaveMeta}
                                >
                                  {isSavingMeta ? 'Сохраняем...' : 'Сохранить'}
                                </Button>
                                <Button
                                  view="flat-secondary"
                                  size="m"
                                  onClick={() => {
                                    setIsEditingMeta(false);
                                    setMetaDraft({
                                      title: selectedVoting.title,
                                      description: selectedVoting.description ?? '',
                                    });
                                  }}
                                  disabled={isSavingMeta}
                                >
                                  Отмена
                                </Button>
                              </div>
                            </>
                          ) : (
                            <p className="admin-detail-description">
                              {selectedVoting.description ?? 'Описание пока не задано.'}
                            </p>
                          )}

                          <div className="admin-detail-subtitle">Номинации</div>
                        <Table
                          columns={nominationColumns}
                          data={nominationRows}
                          emptyMessage="Номинации появятся после настройки голосования."
                          getRowDescriptor={(row) => ({ id: row.id })}
                          width="max"
                        />
                        <NominationPreviewPanel
                          nomination={previewNomination}
                          isLoading={isPreviewLoading}
                          onOpenDialog={() => setIsPreviewOpen(true)}
                        />
                        </>
                      )}
                    </Card>
                  ) : null}
                </div>
              ) : (
                <GameGrid
                  games={games}
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
              onDraftChange={(field, value) =>
                setGameDraft((prev) => ({ ...prev, [field]: value }))
              }
            />

            <NominationPreviewDialog
              open={isPreviewOpen}
              nomination={previewNomination}
              isLoading={isPreviewLoading}
              onClose={() => setIsPreviewOpen(false)}
            />
          </div>
        )}
      />
    </div>
  );
};
