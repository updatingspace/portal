import { request } from './client';

export type ApiHomePageModal = {
  id: number;
  title: string;
  content: string;
  button_text?: string;
  buttonText?: string;
  button_url?: string;
  buttonUrl?: string;
  modal_type?: 'info' | 'warning' | 'success' | 'promo';
  modalType?: 'info' | 'warning' | 'success' | 'promo';
  is_active?: boolean;
  isActive?: boolean;
  display_once?: boolean;
  displayOnce?: boolean;
  start_date?: string | null;
  startDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  order: number;
};

export interface HomePageModal {
  id: number;
  title: string;
  content: string;
  buttonText: string;
  buttonUrl: string;
  modalType: 'info' | 'warning' | 'success' | 'promo';
  isActive: boolean;
  displayOnce: boolean;
  startDate: string | null;
  endDate: string | null;
  order: number;
}

export interface HomePageModalInput {
  title: string;
  content: string;
  buttonText?: string;
  buttonUrl?: string;
  modalType?: 'info' | 'warning' | 'success' | 'promo';
  isActive?: boolean;
  displayOnce?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  order?: number;
}

const mapHomePageModal = (modal: ApiHomePageModal): HomePageModal => ({
  id: modal.id,
  title: modal.title,
  content: modal.content,
  buttonText: modal.buttonText ?? modal.button_text ?? 'OK',
  buttonUrl: modal.buttonUrl ?? modal.button_url ?? '',
  modalType: modal.modalType ?? modal.modal_type ?? 'info',
  isActive: modal.isActive ?? modal.is_active ?? true,
  displayOnce: modal.displayOnce ?? modal.display_once ?? false,
  startDate: modal.startDate ?? modal.start_date ?? null,
  endDate: modal.endDate ?? modal.end_date ?? null,
  order: modal.order ?? 0,
});

const buildHomePageModalPayload = (
  payload: HomePageModalInput,
): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  body.title = payload.title;
  body.content = payload.content;
  if (payload.buttonText !== undefined) body.button_text = payload.buttonText;
  if (payload.buttonUrl !== undefined) body.button_url = payload.buttonUrl;
  if (payload.modalType !== undefined) body.modal_type = payload.modalType;
  if (payload.isActive !== undefined) body.is_active = payload.isActive;
  if (payload.displayOnce !== undefined) body.display_once = payload.displayOnce;
  if (payload.startDate !== undefined) body.start_date = payload.startDate;
  if (payload.endDate !== undefined) body.end_date = payload.endDate;
  if (payload.order !== undefined) body.order = payload.order;
  return body;
};

/**
 * Fetch active homepage modals for display
 */
export const fetchHomePageModals = async (): Promise<HomePageModal[]> => {
  const data = await request<ApiHomePageModal[]>('/personalization/homepage-modals');
  return data.map(mapHomePageModal);
};

/**
 * Fetch all homepage modals for admin (requires superuser)
 */
export const fetchAdminHomePageModals = async (): Promise<HomePageModal[]> => {
  const data = await request<ApiHomePageModal[]>('/personalization/admin/homepage-modals');
  return data.map(mapHomePageModal);
};

/**
 * Create a new homepage modal (requires superuser)
 */
export const createHomePageModal = async (
  payload: HomePageModalInput,
): Promise<HomePageModal> => {
  const body = buildHomePageModalPayload(payload);
  const data = await request<ApiHomePageModal>('/personalization/admin/homepage-modals', {
    method: 'POST',
    body,
  });
  return mapHomePageModal(data);
};

/**
 * Update a homepage modal (requires superuser)
 */
export const updateHomePageModal = async (
  modalId: number,
  payload: HomePageModalInput,
): Promise<HomePageModal> => {
  const body = buildHomePageModalPayload(payload);
  const data = await request<ApiHomePageModal>(`/personalization/admin/homepage-modals/${modalId}`, {
    method: 'PUT',
    body,
  });
  return mapHomePageModal(data);
};

/**
 * Delete a homepage modal (requires superuser)
 */
export const deleteHomePageModal = async (modalId: number): Promise<void> => {
  await request<void>(`/personalization/admin/homepage-modals/${modalId}`, {
    method: 'DELETE',
  });
};
