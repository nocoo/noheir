import { describe, expect, it, beforeEach, vi, beforeAll } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useUnitExportImport } from '../../src/viewmodels/dataManagement/useUnitExportImport';
import type { UnitExportData } from '../../src/services/assetService';

const mockExportUnits = vi.fn();
const mockParseUnitJSON = vi.fn();
const mockImportUnits = vi.fn();

vi.mock('../../src/services/assetService', () => ({
  exportUnits: (...args: unknown[]) => mockExportUnits(...args),
  parseUnitJSON: (...args: unknown[]) => mockParseUnitJSON(...args),
  importUnits: (...args: unknown[]) => mockImportUnits(...args),
}));

// Patch browser APIs inside beforeAll (after happy-dom setup)
beforeAll(() => {
  if (typeof globalThis.URL?.createObjectURL !== 'function') {
    const origURL = globalThis.URL;
    (globalThis as Record<string, unknown>).URL = function (...args: unknown[]) {
      return new origURL(...(args as [string]));
    } as unknown as typeof URL;
    (globalThis.URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => 'blob:test');
    (globalThis.URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
    Object.setPrototypeOf(globalThis.URL, origURL);
  } else {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:test') as unknown as typeof URL.createObjectURL;
    globalThis.URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
  }
});

describe('useUnitExportImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useUnitExportImport());

    expect(result.current.exporting).toBe(false);
    expect(result.current.importState.step).toBe('idle');
    expect(result.current.importDialogOpen).toBe(false);
  });

  it('handles export successfully', async () => {
    const mockData: UnitExportData = {
      version: 1,
      type: 'units',
      exported_at: '2026-01-01T00:00:00Z',
      units: [],
    };
    mockExportUnits.mockResolvedValue(mockData);

    const { result } = renderHook(() => useUnitExportImport());

    await act(async () => {
      await result.current.handleExport();
    });

    expect(mockExportUnits).toHaveBeenCalledTimes(1);
    expect(result.current.exporting).toBe(false);
  });

  it('handles export error gracefully', async () => {
    mockExportUnits.mockRejectedValue(new Error('Export failed'));

    const { result } = renderHook(() => useUnitExportImport());

    await act(async () => {
      await result.current.handleExport();
    });

    expect(result.current.exporting).toBe(false);
  });

  it('does nothing on confirm when not in preview state', async () => {
    const { result } = renderHook(() => useUnitExportImport());

    await act(async () => {
      await result.current.handleImportConfirm();
    });

    expect(mockImportUnits).not.toHaveBeenCalled();
    expect(result.current.importState.step).toBe('idle');
  });

  it('resets to idle on close', () => {
    const { result } = renderHook(() => useUnitExportImport());

    act(() => {
      result.current.handleImportClose();
    });

    expect(result.current.importDialogOpen).toBe(false);
    expect(result.current.importState.step).toBe('idle');
  });

  it('provides fileInputRef', () => {
    const { result } = renderHook(() => useUnitExportImport());
    expect(result.current.fileInputRef).toBeDefined();
    expect(result.current.fileInputRef.current).toBeNull();
  });

  it('does not throw when triggerFileSelect with null ref', () => {
    const { result } = renderHook(() => useUnitExportImport());

    expect(() => {
      act(() => {
        result.current.triggerFileSelect();
      });
    }).not.toThrow();
  });

  it('returns all expected properties', () => {
    const { result } = renderHook(() => useUnitExportImport());

    expect(result.current).toHaveProperty('exporting');
    expect(result.current).toHaveProperty('handleExport');
    expect(result.current).toHaveProperty('importState');
    expect(result.current).toHaveProperty('importDialogOpen');
    expect(result.current).toHaveProperty('fileInputRef');
    expect(result.current).toHaveProperty('triggerFileSelect');
    expect(result.current).toHaveProperty('handleFileSelect');
    expect(result.current).toHaveProperty('handleImportConfirm');
    expect(result.current).toHaveProperty('handleImportClose');
  });
});
