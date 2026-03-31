import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createHomePageModal,
  deleteHomePageModal,
  fetchAdminHomePageModals,
  fetchHomePageModals,
  updateHomePageModal,
} from './personalization';

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe('personalization api mapping', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    document.cookie = 'updspace_csrf=test-token; path=/';
  });

  afterEach(() => {
    document.cookie = 'updspace_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('maps snake_case/camelCase modal fields with defaults', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ([
        {
          id: 1,
          title: 'A',
          content: 'B',
          button_text: 'Open',
          modal_type: 'promo',
          is_active: false,
          display_once: true,
          start_date: '2026-01-01T00:00:00Z',
          end_date: null,
          order: 5,
        },
        {
          id: 2,
          title: 'C',
          content: 'D',
          order: 0,
        },
      ]),
      clone() { return this; },
      headers: new Headers(),
    });

    const result = await fetchHomePageModals();
    expect(result[0]).toMatchObject({
      id: 1,
      buttonText: 'Open',
      modalType: 'promo',
      isActive: false,
      displayOnce: true,
      order: 5,
    });
    expect(result[1]).toMatchObject({
      id: 2,
      buttonText: 'OK',
      buttonUrl: '',
      modalType: 'info',
      isActive: true,
      displayOnce: false,
    });
  });

  it('sends normalized payload on create/update and supports delete', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 3, title: 'X', content: 'Y', order: 1 }),
      clone() { return this; },
      headers: new Headers(),
    });

    await createHomePageModal({
      title: 'X',
      content: 'Y',
      buttonText: 'Go',
      buttonUrl: '/go',
      modalType: 'warning',
      isActive: true,
      displayOnce: true,
      startDate: '2026-01-01T00:00:00Z',
      endDate: null,
      order: 1,
    });

    const createBody = fetchMock.mock.calls[0][1].body;
    expect(createBody).toContain('"button_text":"Go"');
    expect(createBody).toContain('"modal_type":"warning"');
    expect(createBody).toContain('"display_once":true');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 3, title: 'X2', content: 'Y2', order: 2 }),
      clone() { return this; },
      headers: new Headers(),
    });

    await updateHomePageModal(3, { title: 'X2', content: 'Y2', order: 2 });
    expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/personalization/admin/homepage-modals/3');
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      clone() { return this; },
      headers: new Headers(),
    });

    await deleteHomePageModal(3);
    expect(fetchMock.mock.calls[2][1].method).toBe('DELETE');
  });

  it('loads admin modal list endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
      clone() { return this; },
      headers: new Headers(),
    });

    await fetchAdminHomePageModals();
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/personalization/admin/homepage-modals');
  });
});
