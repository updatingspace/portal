/**
 * ResultsVisualization Component
 * 
 * Displays voting results with interactive charts and export capabilities.
 * 
 * Features:
 * - Bar chart for top nominees (Recharts)
 * - Percentage visualization
 * - Winner highlight
 * - Export to CSV/PNG options
 * - Responsive design
 * - Accessibility (ARIA labels, keyboard navigation)
 */

import React, { useMemo } from 'react';
import { Card, Button, Icon, Label } from '@gravity-ui/uikit';
import { ArrowDownToLine, Crown } from '@gravity-ui/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Nomination } from '../unified';

// ============================================================================
// Types
// ============================================================================

export interface ResultsVisualizationProps {
  nominations: Nomination[];
  totalVotes: number;
  title?: string;
  showExport?: boolean;
  maxDisplay?: number;
  className?: string;
}

interface ChartDataPoint {
  id: string;
  title: string;
  votes: number;
  percentage: number;
  isWinner: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const ResultsVisualization: React.FC<ResultsVisualizationProps> = ({
  nominations,
  totalVotes,
  title = 'Результаты голосования',
  showExport = true,
  maxDisplay = 10,
  className = '',
}) => {
  // Prepare chart data
  const chartData = useMemo<ChartDataPoint[]>(() => {
    // Sort by vote count descending
    const sorted = [...nominations]
      .filter((n) => n.vote_count !== undefined && n.vote_count > 0)
      .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
    
    // Take top N
    const topN = sorted.slice(0, maxDisplay);
    
    // Calculate percentages and mark winner
    const maxVotes = topN[0]?.vote_count ?? 0;
    
    return topN.map((nomination) => ({
      id: nomination.id,
      title: nomination.title.length > 30
        ? `${nomination.title.slice(0, 30)}…`
        : nomination.title,
      votes: nomination.vote_count ?? 0,
      percentage: totalVotes > 0 ? ((nomination.vote_count ?? 0) / totalVotes) * 100 : 0,
      isWinner: nomination.vote_count === maxVotes,
    }));
  }, [nominations, totalVotes, maxDisplay]);
  
  // Winner
  const winner = chartData[0];
  
  // Colors
  const winnerColor = '#4CAF50';
  const defaultColor = '#2196F3';
  
  // Export to CSV
  const handleExportCSV = () => {
    const csv = [
      ['Позиция', 'Название', 'Голосов', 'Процент'].join(','),
      ...chartData.map((item, index) => [
        index + 1,
        `"${item.title}"`,
        item.votes,
        `${item.percentage.toFixed(2)}%`,
      ].join(',')),
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `voting-results-${Date.now()}.csv`;
    link.click();
  };
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    
    const data = payload[0].payload as ChartDataPoint;
    
    return (
      <Card className="results-tooltip">
        <div className="results-tooltip__title">{data.title}</div>
        <div className="results-tooltip__votes">
          <strong>{data.votes}</strong> {getVoteLabel(data.votes)}
        </div>
        <div className="results-tooltip__percentage">
          {data.percentage.toFixed(2)}%
        </div>
      </Card>
    );
  };
  
  // Empty state
  if (chartData.length === 0) {
    return (
      <Card className={`results-visualization results-visualization--empty ${className}`}>
        <div className="results-visualization__empty-state">
          <p>Пока нет голосов</p>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className={`results-visualization ${className}`}>
      {/* Header */}
      <div className="results-visualization__header">
        <h2 className="results-visualization__title">{title}</h2>
        
        {showExport && (
          <Button
            view="outlined"
            size="m"
            onClick={handleExportCSV}
            aria-label="Экспортировать результаты в CSV"
          >
            <Icon data={ArrowDownToLine} size={16} />
            <span>Экспорт CSV</span>
          </Button>
        )}
      </div>
      
      {/* Summary */}
      <div className="results-visualization__summary">
        <div className="results-visualization__stat">
          <span className="results-visualization__stat-label">Всего голосов</span>
          <span className="results-visualization__stat-value">{totalVotes}</span>
        </div>
        
        <div className="results-visualization__stat">
          <span className="results-visualization__stat-label">Вариантов</span>
          <span className="results-visualization__stat-value">{chartData.length}</span>
        </div>
      </div>
      
      {/* Winner Highlight */}
      {winner && (
        <div className="results-visualization__winner">
          <Icon data={Crown} size={24} className="results-visualization__winner-icon" />
          <div className="results-visualization__winner-info">
            <Label theme="success" size="m">Лидер</Label>
            <div className="results-visualization__winner-title">{winner.title}</div>
            <div className="results-visualization__winner-stats">
              {winner.votes} {getVoteLabel(winner.votes)} · {winner.percentage.toFixed(1)}%
            </div>
          </div>
        </div>
      )}
      
      {/* Chart */}
      <div className="results-visualization__chart" role="img" aria-label={`График результатов голосования. Лидер: ${winner?.title}`}>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 50)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="title" width={150} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="votes" radius={[0, 8, 8, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.id}
                  fill={entry.isWinner ? winnerColor : defaultColor}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Table (for accessibility and SEO) */}
      <table className="results-visualization__table" aria-label="Таблица результатов голосования">
        <thead>
          <tr>
            <th scope="col">Позиция</th>
            <th scope="col">Название</th>
            <th scope="col">Голосов</th>
            <th scope="col">Процент</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((item, index) => (
            <tr key={item.id} className={item.isWinner ? 'results-table__row--winner' : ''}>
              <td>{index + 1}</td>
              <td>{item.title}</td>
              <td>{item.votes}</td>
              <td>{item.percentage.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

/**
 * Get vote count label (Russian plural forms)
 */
function getVoteLabel(count: number): string {
  if (count % 10 === 1 && count !== 11) return 'голос';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count)) return 'голоса';
  return 'голосов';
}

// ============================================================================
// Export
// ============================================================================

export default ResultsVisualization;
