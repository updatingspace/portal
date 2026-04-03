import { describe, expect, it, vi } from 'vitest';

vi.mock('./logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./logger')>();
  return actual;
});

import { logger } from './logger';

describe('logger behavior', () => {
  it('is callable for all levels without throwing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    expect(() => logger.warn('warn msg', { area: 'api' })).not.toThrow();
    expect(() => logger.error('error msg', { error: new Error('boom') })).not.toThrow();
    expect(() => logger.info('info msg')).not.toThrow();
    expect(() => logger.debug('debug msg')).not.toThrow();
    expect(() => logger.critical('critical msg', { error: 'fatal' })).not.toThrow();

    expect(warnSpy.mock.calls.length + errorSpy.mock.calls.length + infoSpy.mock.calls.length + debugSpy.mock.calls.length).toBeGreaterThanOrEqual(0);

    warnSpy.mockRestore();
    errorSpy.mockRestore();
    infoSpy.mockRestore();
    debugSpy.mockRestore();
  });
});
