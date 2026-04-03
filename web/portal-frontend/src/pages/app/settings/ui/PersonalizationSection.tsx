import {
  DashboardAnalytics,
  DashboardCustomizer,
  UserSettingsPanel,
} from '../../../../features/personalization';

export function PersonalizationSection() {
  return (
    <>
      <UserSettingsPanel className="mb-4" />
      <DashboardCustomizer />
      <DashboardAnalytics />
    </>
  );
}
