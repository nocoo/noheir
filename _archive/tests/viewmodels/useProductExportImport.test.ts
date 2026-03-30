import { describe, expect, it, beforeEach, vi, beforeAll } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useProductExportImport } from '../../src/viewmodels/dataManagement/useProductExportImport';
import type { ProductExportData } from '../../src/services/assetService';

const mockExportProducts = vi.fn();
const mockParseProductJSON = vi.fn();
const mockImportProducts = vi.fn();

vi.mock('../../src/services/assetService', () => ({
  exportProducts: (...args: unknown[]) => mockExportProducts(...args),
  parseProductJSON: (...args: unknown[]) => mockParseProductJSON(...args),
  importProducts: (...args: unknown[]) => mockImportProducts(...args),
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

describe('useProductExportImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useProductExportImport());

    expect(result.current.exporting).toBe(false);
    expect(result.current.importState.step).toBe('idle');
    expect(result.current.importDialogOpen).toBe(false);
  });

  it('handles export successfully', async () => {
    const mockData: ProductExportData = {
      version: 1,
      type: 'products',
      exported_at: '2026-01-01T00:00:00Z',
      products: [],
    };
    mockExportProducts.mockResolvedValue(mockData);

    const { result } = renderHook(() => useProductExportImport());

    await act(async () => {
      await result.current.handleExport();
    });

    expect(mockExportProducts).toHaveBeenCalledTimes(1);
    expect(result.current.exporting).toBe(false);
  });

  it('handles export error gracefully', async () => {
    mockExportProducts.mockRejectedValue(new Error('Export failed'));

    const { result } = renderHook(() => useProductExportImport());

    await act(async () => {
      await result.current.handleExport();
    });

    expect(result.current.exporting).toBe(false);
  });

  it('does nothing on confirm when not in preview state', async () => {
    const { result } = renderHook(() => useProductExportImport());

    await act(async () => {
      await result.current.handleImportConfirm();
    });

    expect(mockImportProducts).not.toHaveBeenCalled();
    expect(result.current.importState.step).toBe('idle');
  });

  it('resets to idle on close', () => {
    const { result } = renderHook(() => useProductExportImport());

    act(() => {
      result.current.handleImportClose();
    });

    expect(result.current.importDialogOpen).toBe(false);
    expect(result.current.importState.step).toBe('idle');
  });

  it('provides fileInputRef', () => {
    const { result } = renderHook(() => useProductExportImport());
    expect(result.current.fileInputRef).toBeDefined();
    expect(result.current.fileInputRef.current).toBeNull();
  });

  it('does not throw when triggerFileSelect with null ref', () => {
    const { result } = renderHook(() => useProductExportImport());

    expect(() => {
      act(() => {
        result.current.triggerFileSelect();
      });
    }).not.toThrow();
  });

  it('returns all expected properties', () => {
    const { result } = renderHook(() => useProductExportImport());

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
