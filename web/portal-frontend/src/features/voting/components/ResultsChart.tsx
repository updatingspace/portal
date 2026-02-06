import React from 'react';
import { Text } from '@gravity-ui/uikit';
import type { PollResults, ResultNomination } from '../types';

export interface ResultsChartProps {
  results?: PollResults;
  nomination?: ResultNomination;
  totalVotes?: number;
}

export const ResultsChart: React.FC<ResultsChartProps> = ({
  results,
  nomination,
  totalVotes,
}) => {
  const nominationResults = nomination ?? results?.nominations[0];

  if (!nominationResults) {
    return (
      <div className="voting-v2__state-card voting-v2__muted" role="status" aria-live="polite">
        Нет данных для отображения
      </div>
    );
  }

  const nominationTotal = totalVotes ?? nominationResults.options.reduce((sum, option) => sum + option.votes, 0);

  const sortedOptions = [...nominationResults.options].sort(
    (a, b) => b.votes - a.votes
  );

  return (
    <div className="voting-v2__grid" aria-live="polite">
      <Text variant="subheader-2">{nominationResults.title}</Text>

      <div className="voting-v2__grid">
        {sortedOptions.map((option) => {
          const percentage = nominationTotal > 0
            ? Math.round((option.votes / nominationTotal) * 100)
            : 0;

          return (
            <div key={option.option_id} className="voting-v2__chart-row">
              <div className="voting-v2__toolbar voting-v2__small">
                <span className="voting-v2__option-title">{option.text}</span>
                <span>{option.votes} голосов ({percentage}%)</span>
              </div>

              <div
                className="voting-v2__chart-track"
                role="meter"
                aria-label={`Доля голосов за вариант ${option.text}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentage}
                aria-valuetext={`${percentage}%`}
              >
                <div
                  className="voting-v2__chart-fill"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="voting-v2__small voting-v2__muted">
        Всего голосов: {nominationTotal}
      </div>
    </div>
  );
};
