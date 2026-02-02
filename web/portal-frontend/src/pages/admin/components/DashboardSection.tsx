import React from 'react';
import { Card, Loader, Table, type TableColumnConfig } from '@gravity-ui/uikit';
import type { AdminStats } from '../../../api/adminVotings';
import type { AdminRow } from '../types';

type DashboardSectionProps = {
  greetingName: string;
  stats: AdminStats | null;
  statsError: string | null;
  isStatsLoading: boolean;
  latestNews: { id: string; badge: string; title: string; text: string }[];
  dashboardRows: AdminRow[];
  adminColumns: TableColumnConfig<AdminRow>[];
  placeholders: AdminRow[];
};

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  greetingName,
  stats,
  statsError,
  isStatsLoading,
  latestNews,
  dashboardRows,
  adminColumns,
  placeholders,
}) => (
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
        <div className="admin-card-title">Метрики голосований</div>
        <div className="text-muted small mb-2">
          {statsError ?? 'Сводка по публикациям и активности голосований.'}
        </div>
        {isStatsLoading ? (
          <div className="admin-loader-box">
            <Loader size="m" />
            <div className="text-muted small">Считаем метрики...</div>
          </div>
        ) : (
          <div className="admin-metrics-grid">
            <div className="admin-metric">
              <div className="admin-metric-value">{stats?.activeVotings ?? '—'}</div>
              <div className="admin-metric-label">активных</div>
            </div>
            <div className="admin-metric">
              <div className="admin-metric-value">{stats?.draftVotings ?? '—'}</div>
              <div className="admin-metric-label">черновиков</div>
            </div>
            <div className="admin-metric">
              <div className="admin-metric-value">{stats?.uniqueVoters ?? '—'}</div>
              <div className="admin-metric-label">уникальных голосующих</div>
            </div>
            <div className="admin-metric">
              <div className="admin-metric-value">{stats?.totalVotes ?? '—'}</div>
              <div className="admin-metric-label">отдано голосов</div>
            </div>
            <div className="admin-metric">
              <div className="admin-metric-value">{stats?.openForVoting ?? '—'}</div>
              <div className="admin-metric-label">сейчас открыты</div>
            </div>
          </div>
        )}
      </Card>
    </div>

    <Card className="admin-card">
      <div className="admin-card-head">
        <div>
          <div className="admin-card-title">Последние новости</div>
          <div className="text-muted small">Данные пока статичны — API новостей добавим позже.</div>
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
          <div className="text-muted small">Открытые и архивные потоки — первые пять по списку.</div>
        </div>
      </div>
      <Table
        columns={adminColumns}
        data={dashboardRows.length ? dashboardRows : placeholders}
        emptyMessage="Активных голосований нет."
        getRowDescriptor={(row) => ({ id: row.id, classNames: ['admin-table-row'] })}
        wordWrap
        width="max"
      />
    </Card>
  </>
);
