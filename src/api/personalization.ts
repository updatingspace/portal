import { request } from './client';

export interface HomePageModal {
  id: number;
  title: string;
  content: string;
  button_text: string;
  button_url: string;
  modal_type: 'info' | 'warning' | 'success' | 'promo';
  display_once: boolean;
  start_date: string | null;
  end_date: string | null;
  order: number;
}

export interface HomePageModalInput {
  title: string;
  content: string;
  button_text?: string;
  button_url?: string;
  modal_type?: 'info' | 'warning' | 'success' | 'promo';
  is_active?: boolean;
  display_once?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  order?: number;
}

/**
 * Fetch active homepage modals for display
 */
export const fetchHomePageModals = async (): Promise<HomePageModal[]> => {
  return await request<HomePageModal[]>('/personalization/homepage-modals');
};

/**
 * Fetch all homepage modals for admin (requires superuser)
 */
export const fetchAdminHomePageModals = async (): Promise<HomePageModal[]> => {
  return await request<HomePageModal[]>('/personalization/admin/homepage-modals');
};

/**
 * Create a new homepage modal (requires superuser)
 */
export const createHomePageModal = async (
  payload: HomePageModalInput,
): Promise<HomePageModal> => {
  return await request<HomePageModal>('/personalization/admin/homepage-modals', {
    method: 'POST',
    body: payload,
  });
};

/**
 * Update a homepage modal (requires superuser)
 */
export const updateHomePageModal = async (
  modalId: number,
  payload: HomePageModalInput,
): Promise<HomePageModal> => {
  return await request<HomePageModal>(`/personalization/admin/homepage-modals/${modalId}`, {
    method: 'PUT',
    body: payload,
  });
};

/**
 * Delete a homepage modal (requires superuser)
 */
export const deleteHomePageModal = async (modalId: number): Promise<void> => {
  await request<void>(`/personalization/admin/homepage-modals/${modalId}`, {
    method: 'DELETE',
  });
};
