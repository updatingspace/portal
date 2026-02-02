import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Loader, Pagination, Text } from '@gravity-ui/uikit';
import { useAuth } from '../../../contexts/AuthContext';
import { can } from '../../../features/rbac/can';
import { PollCard } from '../../../features/voting/components/PollCard';
import { isRateLimitError, usePolls } from '../../../features/voting';
import type { PollStatus } from '../../../features/voting';
import { getLocale } from '../../../shared/lib/locale';

const PAGE_SIZE = 12;

const STATUS_OPTIONS = [
    { value: 'all', label: 'Все' },
    { value: 'active', label: 'Активные' },
    { value: 'draft', label: 'Черновики' },
    { value: 'closed', label: 'Завершённые' },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]['value'];

export const PollsPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
    const { user } = useAuth();

    const offset = (page - 1) * PAGE_SIZE;
    const effectiveStatus = statusFilter === 'all' ? undefined : (statusFilter as PollStatus);
    const locale = user?.language ?? getLocale();
    const hasCapabilities = Boolean(user?.capabilities?.length || user?.roles?.length);
    const canManage = Boolean(user?.isSuperuser || (!hasCapabilities ? true : can(user, ['voting.votings.admin', 'voting.nominations.admin'])));
    
    const { 
        data, 
        isLoading, 
        isError, 
        error, 
        refetch,
        isFetching 
    } = usePolls({
        limit: PAGE_SIZE,
        offset,
        status: effectiveStatus,
    });

    const polls = data?.items ?? [];
    const pagination = data?.pagination;
    const totalPages = pagination ? Math.ceil(pagination.total / PAGE_SIZE) : 1;

    const handlePageChange: React.ComponentProps<typeof Pagination>['onUpdate'] = (newPage) => {
        setPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const statusLabel = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? 'Все';

    const statusTabs = useMemo(
        () =>
            STATUS_OPTIONS.map((option) => (
                <Button
                    key={option.value}
                    view={statusFilter === option.value ? 'action' : 'outlined'}
                    size="s"
                    onClick={() => {
                        setStatusFilter(option.value);
                        setPage(1);
                    }}
                >
                    {option.label}
                </Button>
            )),
        [statusFilter],
    );

    if (isLoading && !polls.length) {
        return (
            <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader size="l" />
                    <Text variant="body-2" color="secondary" className="mt-3">
                        Загружаем голосования…
                    </Text>
                </div>
            </div>
        );
    }

    if (isError && !polls.length) {
        const isRateLimit = isRateLimitError(error);
        return (
            <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-6 text-center">
                    <Text variant="subheader-2" className="mb-2">
                        {isRateLimit ? 'Слишком много запросов' : 'Не удалось загрузить список'}
                    </Text>
                    <Text variant="body-2" color="secondary" className="mb-4">
                        {isRateLimit
                            ? `Подождите ${error.retryAfter} сек. и попробуйте снова.`
                            : 'Проверьте соединение и обновите страницу.'}
                    </Text>
                    <Button onClick={() => refetch()} view="action" width="max">
                        Повторить
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-64px)] bg-slate-50">
            <div className="bg-white border-b border-slate-200">
                <div className="container max-w-7xl mx-auto px-4 py-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <Text variant="header-1" className="text-slate-900">
                                Голосования
                            </Text>
                            <Text variant="body-2" color="secondary" className="mt-1">
                                Управляйте опросами и следите за участием сообщества.
                            </Text>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {canManage && (
                                <Link to="/app/voting/create">
                                    <Button view="action">Создать опрос</Button>
                                </Link>
                            )}
                            <Link to="/app/voting/templates">
                                <Button view="outlined">Шаблоны</Button>
                            </Link>
                            <Link to="/app/voting/analytics">
                                <Button view="outlined">Аналитика</Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
                <Card className="p-4 bg-white">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <Text variant="subheader-2">Быстрый обзор</Text>
                            <Text variant="body-2" color="secondary">
                                Выберите нужный статус и откройте опрос для голосования или настройки.
                            </Text>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {statusTabs}
                        </div>
                    </div>
                </Card>

                {isFetching && polls.length > 0 && (
                    <div className="fixed top-4 right-4 z-50">
                        <Loader size="s" />
                    </div>
                )}

                {!polls.length ? (
                    <Card className="p-10 text-center">
                        <Text variant="subheader-2" className="mb-2">
                            {statusFilter === 'all' ? 'Пока нет опросов' : `Нет опросов: ${statusLabel}`}
                        </Text>
                        <Text variant="body-2" color="secondary" className="mb-4">
                            {statusFilter === 'all'
                                ? 'Создайте новый опрос или выберите шаблон, чтобы начать.'
                                : 'Попробуйте выбрать другой статус или создайте новый опрос.'}
                        </Text>
                        <div className="flex flex-wrap justify-center gap-2">
                            {canManage && (
                                <Link to="/app/voting/create">
                                    <Button view="action">Создать опрос</Button>
                                </Link>
                            )}
                            <Link to="/app/voting/templates">
                                <Button view="outlined">Открыть шаблоны</Button>
                            </Link>
                        </div>
                    </Card>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {polls.map((poll) => {
                                const primaryLink =
                                    poll.status === 'draft' && canManage
                                        ? `/app/voting/${poll.id}/manage`
                                        : `/app/voting/${poll.id}`;
                                const primaryLabel = poll.status === 'draft' && canManage ? 'Настроить' : 'Открыть';
                                const showManage = canManage && poll.status !== 'draft';
                                const showResults = poll.status === 'closed';

                                return (
                                    <PollCard
                                        key={poll.id}
                                        poll={poll}
                                        locale={locale}
                                        actions={
                                            <>
                                                <Link to={primaryLink}>
                                                    <Button view="action" size="m">
                                                        {primaryLabel}
                                                    </Button>
                                                </Link>
                                                {showManage && (
                                                    <Link to={`/app/voting/${poll.id}/manage`}>
                                                        <Button view="outlined" size="m">
                                                            Управление
                                                        </Button>
                                                    </Link>
                                                )}
                                                {showResults && (
                                                    <Link to={`/app/voting/${poll.id}/results`}>
                                                        <Button view="outlined" size="m">
                                                            Результаты
                                                        </Button>
                                                    </Link>
                                                )}
                                            </>
                                        }
                                    />
                                );
                            })}
                        </div>

                        {totalPages > 1 && (
                            <div className="mt-8 flex justify-center">
                                <Pagination
                                    page={page}
                                    pageSize={PAGE_SIZE}
                                    total={pagination?.total ?? 0}
                                    onUpdate={handlePageChange}
                                />
                            </div>
                        )}

                        {pagination && (
                            <div className="mt-4 text-center text-sm text-gray-500">
                                Показано {offset + 1}-{Math.min(offset + PAGE_SIZE, pagination.total)} из {pagination.total}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
