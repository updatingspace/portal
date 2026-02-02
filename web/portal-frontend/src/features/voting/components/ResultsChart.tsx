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
      <div className="text-center py-8 text-gray-500">
        Нет данных для отображения
      </div>
    );
  }
  
  // Calculate total votes for percentage calculation
  const nominationTotal = totalVotes ?? nominationResults.options.reduce((sum, option) => sum + option.votes, 0);
  
  // Sort options by vote count (descending)
  const sortedOptions = [...nominationResults.options].sort(
    (a, b) => b.votes - a.votes
  );
  
  return (
    <div className="space-y-4">
      <Text variant="subheader-2">{nominationResults.title}</Text>
      
      <div className="space-y-3">
        {sortedOptions.map((option) => {
          const percentage = nominationTotal > 0
            ? Math.round((option.votes / nominationTotal) * 100)
            : 0;
            
          return (
            <div key={option.option_id} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{option.text}</span>
                <span>{option.votes} голосов ({percentage}%)</span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="text-sm text-gray-500 pt-2 border-t">
        Всего голосов: {nominationTotal}
      </div>
    </div>
  );
};
