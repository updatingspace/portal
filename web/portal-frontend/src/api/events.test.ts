import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createEvent,
  exportEventAsIcs,
  fetchEvent,
  fetchEvents,
  markAttendance,
  setRsvp,
  updateEvent,
} from './events';

vi.mock('./client', () => ({ request: vi.fn() }));
import { request } from './client';

describe('events api wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('builds query and calls CRUD/rsvp endpoints', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({ items: [], meta: { total: 0 } })
      .mockResolvedValueOnce({ id: 'e1' })
      .mockResolvedValueOnce({ id: 'e2' })
      .mockResolvedValueOnce({ id: 'e2' })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    await fetchEvents({ from: '2026-01-01', to: '2026-01-10', limit: 10, offset: 0 });
    await fetchEvent('e1');
    await createEvent({ title: 'Raid', starts_at: '2026-01-02T20:00:00Z' } as never);
    await updateEvent('e2', { title: 'Raid 2' } as never);
    await setRsvp('e2', 'going' as never);
    await markAttendance('e2', 'u1');

    expect(request).toHaveBeenNthCalledWith(1, expect.stringContaining('/events?'));
    expect(request).toHaveBeenNthCalledWith(2, '/events/e1');
    expect(request).toHaveBeenNthCalledWith(3, '/events', expect.objectContaining({ method: 'POST' }));
    expect(request).toHaveBeenNthCalledWith(4, '/events/e2', expect.objectContaining({ method: 'PATCH' }));
    expect(request).toHaveBeenNthCalledWith(5, '/events/e2/rsvp', expect.objectContaining({ body: { status: 'going' } }));
    expect(request).toHaveBeenNthCalledWith(6, '/events/e2/attendance', expect.objectContaining({ body: { userId: 'u1' } }));
  });

  it('exports ics and throws readable error on failed response', async () => {
    const blob = new Blob(['BEGIN:VCALENDAR']);
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, blob: async () => blob } as Response)
      .mockResolvedValueOnce({ ok: false, statusText: 'Forbidden' } as Response);

    await expect(exportEventAsIcs('e1')).resolves.toBe(blob);
    await expect(exportEventAsIcs('e2')).rejects.toThrow('Failed to export event: Forbidden');

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      '/api/v1/events/e1/ics',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });
});
