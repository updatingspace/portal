// Voting Components Index
// Legacy components
export * from './PollCard';
export * from './PollStatusBadge';
export * from './PollForm';
export * from './NominationForm';
export * from './OptionForm';
export * from './ResultsChart';
export * from './ParticipantList';
export * from './ScheduleForm';

// New unified components (Phase 3)
export * from './VotingCard';
export * from './VotingList';
export * from './NominationCard';
export * from './VoteButton';
export * from './ResultsVisualization';
export * from './VotingAlerts';
export * from './ProgressiveDisclosure';

// Skeletons (specific exports to avoid naming conflicts)
export {
  VotingListSkeleton,
  NominationListSkeleton,
  NominationCardSkeleton,
  ResultsSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  TextSkeleton,
} from './skeletons';

// Styles - import in your app entry point
// import '@/features/voting/components/styles.css';