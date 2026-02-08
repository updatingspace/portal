import React from 'react';
import { Navigate } from 'react-router-dom';

import { env } from '@/shared/config/env';
import { PollsPage } from '../../modules/voting/pages/PollsPage';
import { PollPage } from '../../modules/voting/pages/PollPage';
import { AnalyticsDashboardPage } from '../../modules/voting/pages/AnalyticsDashboardPage';

const VotingDisabledFallback: React.FC = () => <Navigate to="/choose-tenant" replace />;

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
