/**
 * API client for content management (modals, widgets, analytics)
 */
import {
  request,
  requestResult,
} from '../../../api/client';
import type {
  HomePageModal,
  HomePageModalInput,
  ModalListFilters,
  BulkActionPayload,
  BulkActionResult,
  ContentWidget,
  ContentWidgetInput,
  ModalAnalytics,
  AnalyticsReport,
  AnalyticsEventPayload,
  DashboardLayout,
  DashboardLayoutInput,
  DashboardWidget,
  DashboardWidgetInput,
} from '../types';

const MODALS_BASE = '/personalization';
const ADMIN_MODALS_BASE = '/personalization/admin/homepage-modals';
const WIDGETS_BASE = '/personalization/admin/content-widgets';
const ANALYTICS_BASE = '/personalization/analytics';
const DASHBOARDS_BASE = '/personalization/admin/dashboards';

export type OptionalPersonalizationRead<T> =
  | { status: 'ok'; data: T }
  | { status: 'forbidden' };

async function requestOptionalPersonalizationRead<T>(
  path: string,
): Promise<OptionalPersonalizationRead<T>> {
  const result = await requestResult<T>(path, {
    noRetry: true,
  });
  if (result.ok) {
    return { status: 'ok', data: result.data };
  }
  return { status: 'forbidden' };
}

// =============================================================================
// Homepage Modals API (User-facing)
// =============================================================================

/**
 * Fetch active homepage modals for display
 */
export async function fetchActiveModals(
  language: string = 'en'
): Promise<HomePageModal[]> {
  return request<HomePageModal[]>(
    `${MODALS_BASE}/homepage-modals?language=${language}`,
    { noRetry: true },
  );
}

// =============================================================================
// Homepage Modals Admin API
// =============================================================================

/**
 * Fetch all homepage modals for admin with filtering
 */
export async function fetchModals(
  filters?: ModalListFilters & { limit?: number; offset?: number }
): Promise<HomePageModal[]> {
  const params = new URLSearchParams();

  if (filters) {
    if (filters.includeDeleted) params.set('include_deleted', 'true');
    if (filters.isActive !== undefined)
      params.set('is_active', String(filters.isActive));
    if (filters.modalType) params.set('modal_type', filters.modalType);
    if (filters.search) params.set('search', filters.search);
    if (filters.startDateFrom)
      params.set('start_date_from', filters.startDateFrom.toISOString());
    if (filters.startDateTo)
      params.set('start_date_to', filters.startDateTo.toISOString());
    if (typeof filters.limit === 'number') params.set('limit', String(filters.limit));
    if (typeof filters.offset === 'number') params.set('offset', String(filters.offset));
  }

  const query = params.toString();
  return request<HomePageModal[]>(
    `${ADMIN_MODALS_BASE}${query ? `?${query}` : ''}`,
    { noRetry: true },
  );
}

/**
 * Fetch a single homepage modal by ID
 */
export async function fetchModal(modalId: number): Promise<HomePageModal> {
  return request<HomePageModal>(`${ADMIN_MODALS_BASE}/${modalId}`, {
    noRetry: true,
  });
}

/**
 * Create a new homepage modal
 */
export async function createModal(
  payload: HomePageModalInput
): Promise<HomePageModal> {
  return request<HomePageModal>(ADMIN_MODALS_BASE, {
    method: 'POST',
    body: payload,
    noRetry: true,
  });
}

/**
 * Update a homepage modal
 */
export async function updateModal(
  modalId: number,
  payload: HomePageModalInput
): Promise<HomePageModal> {
  return request<HomePageModal>(`${ADMIN_MODALS_BASE}/${modalId}`, {
    method: 'PUT',
    body: payload,
    noRetry: true,
  });
}

/**
 * Delete a homepage modal (soft delete by default)
 */
export async function deleteModal(
  modalId: number,
  hard: boolean = false
): Promise<{ success: boolean }> {
  return request(`${ADMIN_MODALS_BASE}/${modalId}?hard=${hard}`, {
    method: 'DELETE',
    noRetry: true,
  });
}

/**
 * Restore a soft-deleted homepage modal
 */
export async function restoreModal(modalId: number): Promise<HomePageModal> {
  return request<HomePageModal>(`${ADMIN_MODALS_BASE}/${modalId}/restore`, {
    method: 'POST',
    noRetry: true,
  });
}

/**
 * Perform bulk action on modals
 */
export async function bulkActionModals(
  payload: BulkActionPayload
): Promise<BulkActionResult> {
  return request<BulkActionResult>(`${ADMIN_MODALS_BASE}/bulk`, {
    method: 'POST',
    body: {
      modal_ids: payload.modalIds,
      action: payload.action,
    },
    noRetry: true,
  });
}

/**
 * Preview a modal as it would appear to users
 */
export async function previewModal(
  modalId: number,
  language: string = 'en'
): Promise<HomePageModal> {
  return request<HomePageModal>(
    `${ADMIN_MODALS_BASE}/${modalId}/preview?language=${language}`
  );
}

// =============================================================================
// Content Widgets Admin API
// =============================================================================

/**
 * Fetch all content widgets for admin
 */
export async function fetchWidgets(options?: {
  includeDeleted?: boolean;
  widgetType?: string;
  placement?: string;
  limit?: number;
  offset?: number;
}): Promise<ContentWidget[]> {
  const params = new URLSearchParams();

  if (options?.includeDeleted) params.set('include_deleted', 'true');
  if (options?.widgetType) params.set('widget_type', options.widgetType);
  if (options?.placement) params.set('placement', options.placement);
  if (typeof options?.limit === 'number') params.set('limit', String(options.limit));
  if (typeof options?.offset === 'number') params.set('offset', String(options.offset));

  const query = params.toString();
  return request<ContentWidget[]>(`${WIDGETS_BASE}${query ? `?${query}` : ''}`, {
    noRetry: true,
  });
}

/**
 * Create a new content widget
 */
export async function createWidget(
  payload: ContentWidgetInput
): Promise<ContentWidget> {
  return request<ContentWidget>(WIDGETS_BASE, {
    method: 'POST',
    body: payload,
    noRetry: true,
  });
}

/**
 * Update a content widget
 */
export async function updateWidget(
  widgetId: string,
  payload: ContentWidgetInput
): Promise<ContentWidget> {
  return request<ContentWidget>(`${WIDGETS_BASE}/${widgetId}`, {
    method: 'PUT',
    body: payload,
    noRetry: true,
  });
}

/**
 * Delete a content widget
 */
export async function deleteWidget(
  widgetId: string,
  hard: boolean = false
): Promise<{ success: boolean }> {
  return request(`${WIDGETS_BASE}/${widgetId}?hard=${hard}`, {
    method: 'DELETE',
    noRetry: true,
  });
}

// =============================================================================
// Analytics API
// =============================================================================

/**
 * Track a modal analytics event
 */
export async function trackEvent(
  payload: AnalyticsEventPayload
): Promise<{ success: boolean }> {
  return request(`${ANALYTICS_BASE}/track`, {
    method: 'POST',
    body: {
      modal_id: payload.modalId,
      event_type: payload.eventType,
      session_id: payload.sessionId || '',
      metadata: payload.metadata || {},
    },
    noRetry: true,
  });
}

/**
 * Get modal analytics for admin
 */
export async function fetchModalAnalytics(
  days: number = 30
): Promise<OptionalPersonalizationRead<ModalAnalytics[]>> {
  return requestOptionalPersonalizationRead<ModalAnalytics[]>(
    `${MODALS_BASE}/admin/analytics/modals?days=${days}`
  );
}

/**
 * Get analytics report for admin dashboard
 */
export async function fetchAnalyticsReport(
  days: number = 30
): Promise<OptionalPersonalizationRead<AnalyticsReport>> {
  return requestOptionalPersonalizationRead<AnalyticsReport>(
    `${MODALS_BASE}/admin/analytics/report?days=${days}`
  );
}

// =============================================================================
// Dashboard API
// =============================================================================

export async function fetchDashboardLayouts(
  includeDeleted: boolean = false,
  limit: number = 100,
  offset: number = 0
): Promise<OptionalPersonalizationRead<DashboardLayout[]>> {
  return requestOptionalPersonalizationRead<DashboardLayout[]>(
    `${DASHBOARDS_BASE}/layouts?include_deleted=${includeDeleted}&limit=${limit}&offset=${offset}`
  );
}

export async function createDashboardLayout(
  payload: DashboardLayoutInput
): Promise<DashboardLayout> {
  return request<DashboardLayout>(`${DASHBOARDS_BASE}/layouts`, {
    method: 'POST',
    body: payload,
    noRetry: true,
  });
}

export async function updateDashboardLayout(
  layoutId: string,
  payload: DashboardLayoutInput
): Promise<DashboardLayout> {
  return request<DashboardLayout>(`${DASHBOARDS_BASE}/layouts/${layoutId}`, {
    method: 'PUT',
    body: payload,
    noRetry: true,
  });
}

export async function deleteDashboardLayout(
  layoutId: string,
  hard: boolean = false
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`${DASHBOARDS_BASE}/layouts/${layoutId}?hard=${hard}`, {
    method: 'DELETE',
    noRetry: true,
  });
}

export async function fetchDashboardWidgets(
  layoutId: string,
  includeDeleted: boolean = false,
  limit: number = 200,
  offset: number = 0
): Promise<OptionalPersonalizationRead<DashboardWidget[]>> {
  return requestOptionalPersonalizationRead<DashboardWidget[]>(
    `${DASHBOARDS_BASE}/layouts/${layoutId}/widgets?include_deleted=${includeDeleted}&limit=${limit}&offset=${offset}`
  );
}

export async function createDashboardWidget(
  layoutId: string,
  payload: DashboardWidgetInput
): Promise<DashboardWidget> {
  return request<DashboardWidget>(`${DASHBOARDS_BASE}/layouts/${layoutId}/widgets`, {
    method: 'POST',
    body: payload,
    noRetry: true,
  });
}

export async function updateDashboardWidget(
  widgetId: string,
  payload: DashboardWidgetInput
): Promise<DashboardWidget> {
  return request<DashboardWidget>(`${DASHBOARDS_BASE}/widgets/${widgetId}`, {
    method: 'PUT',
    body: payload,
    noRetry: true,
  });
}

export async function deleteDashboardWidget(
  widgetId: string,
  hard: boolean = false
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`${DASHBOARDS_BASE}/widgets/${widgetId}?hard=${hard}`, {
    method: 'DELETE',
    noRetry: true,
  });
}

export async function restoreWidget(widgetId: string): Promise<ContentWidget> {
  return request<ContentWidget>(`${WIDGETS_BASE}/${widgetId}/restore`, {
    method: 'POST',
    noRetry: true,
  });
}

export async function restoreDashboardLayout(layoutId: string): Promise<DashboardLayout> {
  return request<DashboardLayout>(`${DASHBOARDS_BASE}/layouts/${layoutId}/restore`, {
    method: 'POST',
    noRetry: true,
  });
}

export async function restoreDashboardWidget(widgetId: string): Promise<DashboardWidget> {
  return request<DashboardWidget>(`${DASHBOARDS_BASE}/widgets/${widgetId}/restore`, {
    method: 'POST',
    noRetry: true,
  });
}
