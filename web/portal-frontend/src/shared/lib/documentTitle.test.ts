import { describe, expect, it } from 'vitest';

import { buildDocumentTitle } from './documentTitle';

describe('buildDocumentTitle', () => {
  it('builds a page-specific title with tenant and app name', () => {
    expect(buildDocumentTitle({ pageTitle: 'Опросы', tenantSlug: 'aef' })).toBe(
      'Опросы · AEF · UpdSpace Portal',
    );
  });

  it('falls back to the app title when page title is absent', () => {
    expect(buildDocumentTitle()).toBe('UpdSpace Portal');
  });

  it('avoids duplicating the app title', () => {
    expect(buildDocumentTitle({ pageTitle: 'UpdSpace Portal', tenantSlug: 'aef' })).toBe(
      'AEF · UpdSpace Portal',
    );
  });
});
