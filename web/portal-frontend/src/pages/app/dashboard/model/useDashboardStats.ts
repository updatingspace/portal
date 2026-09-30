export type DashboardStat = {title: string; value: string; description: string};
/** No aggregate counts are available from the current dashboard contract. */
export const useDashboardStats = () => ({stats: [] as DashboardStat[], isLoading: false});
