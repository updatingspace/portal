import { describe, it, expect } from 'vitest';

import { sanitizeRichHtml, sanitizeSvg } from './sanitizeHtml';
import { sanitizeInternalPath } from './tenant';

describe('sanitizeRichHtml', () => {
  it('removes <script> tags but keeps text', () => {
    const out = sanitizeRichHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).toContain('<p>hi</p>');
    expect(out.toLowerCase()).not.toContain('<script');
  });

  it('strips event handlers and javascript: urls', () => {
    const out = sanitizeRichHtml(
      '<img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a>',
    );
    expect(out.toLowerCase()).not.toContain('onerror');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('keeps safe formatting markup', () => {
    const out = sanitizeRichHtml('<b>bold</b> <i>it</i> <ul><li>x</li></ul>');
    expect(out).toContain('<b>bold</b>');
    expect(out).toContain('<li>x</li>');
  });

  it('handles null/undefined', () => {
    expect(sanitizeRichHtml(null)).toBe('');
    expect(sanitizeRichHtml(undefined)).toBe('');
  });
});

describe('sanitizeSvg', () => {
  it('keeps svg shapes but strips script', () => {
    const out = sanitizeSvg(
      '<svg><rect width="10" height="10"/><script>alert(1)</script></svg>',
    );
    expect(out.toLowerCase()).toContain('<svg');
    expect(out.toLowerCase()).toContain('<rect');
    expect(out.toLowerCase()).not.toContain('<script');
  });

  it('strips onload handler on svg', () => {
    const out = sanitizeSvg('<svg onload="alert(1)"><path d="M0 0"/></svg>');
    expect(out.toLowerCase()).not.toContain('onload');
  });
});

describe('sanitizeInternalPath (open redirect guard)', () => {
  it('passes through safe internal paths', () => {
    expect(sanitizeInternalPath('/t/acme/app', '/def')).toBe('/t/acme/app');
  });

  it('rejects external and protocol-relative urls', () => {
    expect(sanitizeInternalPath('https://evil.com', '/def')).toBe('/def');
    expect(sanitizeInternalPath('http://evil.com', '/def')).toBe('/def');
    expect(sanitizeInternalPath('//evil.com', '/def')).toBe('/def');
  });

  it('rejects non-absolute and empty values', () => {
    expect(sanitizeInternalPath('choose-tenant', '/def')).toBe('/def');
    expect(sanitizeInternalPath('', '/def')).toBe('/def');
    expect(sanitizeInternalPath(null, '/def')).toBe('/def');
  });
});
