import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_SITE_NAME,
  getSiteNameDisplay,
  normalizeSiteName,
  shouldAutoCreateMetadata,
  validateSiteName,
} from '../../src/domain/settings/siteName';

describe('siteName domain', () => {
  it('normalizes site name by trimming', () => {
    expect(normalizeSiteName('  hello  ')).toBe('hello');
  });

  it('validates non-empty site name', () => {
    expect(validateSiteName('ok').valid).toBe(true);
    expect(validateSiteName('   ').valid).toBe(false);
  });

  it('returns default display for empty name', () => {
    expect(getSiteNameDisplay('')).toBe('未设置');
    expect(getSiteNameDisplay(undefined)).toBe('未设置');
  });

  it('exposes default site name', () => {
    expect(DEFAULT_SITE_NAME.length).toBeGreaterThan(0);
  });

  it('decides when to auto-create metadata', () => {
    expect(
      shouldAutoCreateMetadata({
        user: { id: '1' },
        loading: false,
        data: null,
        error: null,
        autoCreated: false,
      })
    ).toBe(true);
    expect(
      shouldAutoCreateMetadata({
        user: null,
        loading: false,
        data: null,
        error: null,
        autoCreated: false,
      })
    ).toBe(false);
  });
});
