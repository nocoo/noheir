import { describe, expect, it } from 'bun:test';
import { formatImportDate } from '../../src/domain/dataManagement';

describe('dataManagement domain', () => {
  it('formats import date in zh-CN locale', () => {
    const result = formatImportDate('2024-06-15T14:30:00Z');
    // Should contain year, month, day
    expect(result).toContain('2024');
    expect(result).toContain('06');
    expect(result).toContain('15');
  });

  it('handles ISO date strings', () => {
    const result = formatImportDate('2025-01-01T00:00:00.000Z');
    expect(result).toContain('2025');
    expect(result).toContain('01');
  });
});
