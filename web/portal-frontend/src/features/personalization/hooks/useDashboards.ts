import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createDashboardLayout,
  createDashboardWidget,
  deleteDashboardLayout,
  deleteDashboardWidget,
  fetchDashboardLayouts,
  fetchDashboardWidgets,
  updateDashboardLayout,
  updateDashboardWidget,
} from '../api/contentApi';
import type {
  DashboardLayoutInput,
  DashboardWidgetInput,
} from '../types';

const DASHBOARDS_QUERY_KEY = 'dashboard-layouts';

export function useDashboards(includeDeleted: boolean = false) {
  const queryClient = useQueryClient();

  const {
    data: layouts = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [DASHBOARDS_QUERY_KEY, includeDeleted],
    queryFn: () => fetchDashboardLayouts(includeDeleted),
  });

  const createLayoutMutation = useMutation({
    mutationFn: createDashboardLayout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DASHBOARDS_QUERY_KEY] });
    },
  });

  const updateLayoutMutation = useMutation({
    mutationFn: ({ layoutId, payload }: { layoutId: string; payload: DashboardLayoutInput }) =>
      updateDashboardLayout(layoutId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DASHBOARDS_QUERY_KEY] });
    },
  });

  const deleteLayoutMutation = useMutation({
    mutationFn: ({ layoutId, hard }: { layoutId: string; hard?: boolean }) =>
      deleteDashboardLayout(layoutId, hard),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DASHBOARDS_QUERY_KEY] });
    },
  });

  return {
    layouts,
    isLoading,
    error,
    refetch,
    createLayout: createLayoutMutation.mutateAsync,
    updateLayout: (layoutId: string, payload: DashboardLayoutInput) =>
      updateLayoutMutation.mutateAsync({ layoutId, payload }),
    deleteLayout: (layoutId: string, hard?: boolean) =>
      deleteLayoutMutation.mutateAsync({ layoutId, hard }),
  };
}

export function useDashboardWidgets(layoutId: string | null, includeDeleted: boolean = false) {
  const queryClient = useQueryClient();

  const {
    data: widgets = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [DASHBOARDS_QUERY_KEY, 'widgets', layoutId, includeDeleted],
    queryFn: () => (layoutId ? fetchDashboardWidgets(layoutId, includeDeleted) : []),
    enabled: !!layoutId,
  });

  const createWidgetMutation = useMutation({
    mutationFn: ({ targetLayoutId, payload }: { targetLayoutId: string; payload: DashboardWidgetInput }) =>
      createDashboardWidget(targetLayoutId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DASHBOARDS_QUERY_KEY, 'widgets', layoutId] });
    },
  });

  const updateWidgetMutation = useMutation({
    mutationFn: ({ widgetId, payload }: { widgetId: string; payload: DashboardWidgetInput }) =>
      updateDashboardWidget(widgetId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DASHBOARDS_QUERY_KEY, 'widgets', layoutId] });
    },
  });

  const deleteWidgetMutation = useMutation({
    mutationFn: ({ widgetId, hard }: { widgetId: string; hard?: boolean }) =>
      deleteDashboardWidget(widgetId, hard),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DASHBOARDS_QUERY_KEY, 'widgets', layoutId] });
    },
  });

  return {
    widgets,
    isLoading,
    error,
    refetch,
    createWidget: (payload: DashboardWidgetInput) => {
      if (!layoutId) {
        throw new Error('layoutId is required to create widget');
      }
      return createWidgetMutation.mutateAsync({ targetLayoutId: layoutId, payload });
    },
    updateWidget: (widgetId: string, payload: DashboardWidgetInput) =>
      updateWidgetMutation.mutateAsync({ widgetId, payload }),
    deleteWidget: (widgetId: string, hard?: boolean) =>
      deleteWidgetMutation.mutateAsync({ widgetId, hard }),
  };
}
