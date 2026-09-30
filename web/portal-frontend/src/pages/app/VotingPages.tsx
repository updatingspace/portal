import React from 'react';
import { FeatureGate } from '../../app/guards/FeatureGate';

import { env } from '@/shared/config/env';
import { PollsPage } from '../../modules/voting/pages/PollsPage';
import { PollPage } from '../../modules/voting/pages/PollPage';
import { AnalyticsDashboardPage } from '../../modules/voting/pages/AnalyticsDashboardPage';

const VotingDisabledFallback: React.FC = () => <FeatureGate>{null}</FeatureGate>;

export const VotingPage: React.FC = () => {
  if (!env.votingUiV2) {
    return <VotingDisabledFallback />;
  }
  return <PollsPage />;
};

export const VotingCampaignPage: React.FC = () => {
  if (!env.votingUiV2) {
    return <VotingDisabledFallback />;
  }
  return <PollPage />;
};

export const VotingAnalyticsPage: React.FC = () => {
  if (!env.votingUiV2) {
    return <VotingDisabledFallback />;
  }
  return <AnalyticsDashboardPage />;
};
