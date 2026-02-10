import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useAssetExportImport } from '../../src/viewmodels/dataManagement/useAssetExportImport';

// Mock assetService
const mockExportAssets = vi.fn();
const mockParseAssetJSON = vi.fn();
const mockImportAssets = vi.fn();

vi.mock('../../src/services/assetService', () => ({
  exportAssets: (...args: unknown[]) => mockExportAssets(...args),
  parseAssetJSON: (...args: unknown[]) => mockParseAssetJSON(...args),
  importAssets: (...args: unknown[]) => mockImportAssets(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();

  // Mock URL.createObjectURL/revokeObjectURL (these don't affect renderHook)
  if (!globalThis.URL.createObjectURL) {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  } else {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
  }
  if (!globalThis.URL.revokeObjectURL) {
    globalThis.URL.revokeObjectURL = vi.fn();
  } else {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  }
});

const VALID_EXPORT_DATA = {
  version: 1 as const,
  exported_at: '2026-01-01T00:00:00.000Z',
  products: [
    { name: 'Test Product', channel: '招商银行', category: '定期存款', currency: 'CNY', lock_period_days: 30 },
  ],
  units: [
    { unit_code: 'U001', amount: 10000, currency: 'CNY', status: '已成立', strategy: '短期理财', tactics: '定期存款' },
  ],
};

describe('useAssetExportImport', () => {
  describe('initial state', () => {
    it('starts with idle state', () => {
      const { result } = renderHook(() => useAssetExportImport());
      expect(result.current.exporting).toBe(false);
      expect(result.current.importState).toEqual({ step: 'idle' });
      expect(result.current.importDialogOpen).toBe(false);
    });
  });

  describe('export', () => {
    it('calls exportAssets and resets exporting flag', async () => {
      mockExportAssets.mockResolvedValue(VALID_EXPORT_DATA);

      const { result } = renderHook(() => useAssetExportImport());

      await act(async () => {
        await result.current.handleExport();
      });

      expect(mockExportAssets).toHaveBeenCalled();
      expect(result.current.exporting).toBe(false);
    });

    it('handles export errors gracefully', async () => {
      mockExportAssets.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAssetExportImport());

      await act(async () => {
        await result.current.handleExport();
      });

      expect(result.current.exporting).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('import - file selection', () => {
    let originalFileReader: typeof FileReader;

    beforeEach(() => {
      originalFileReader = globalThis.FileReader;
    });

    // Use afterEach from bun:test — need to import it
    // Restore FileReader after each test in this group
    function restoreFileReader() {
      globalThis.FileReader = originalFileReader;
    }

    function setupFileReader(fileContent: string) {
      const mockFileReader = {
        readAsText: vi.fn(),
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        result: fileContent,
      };
      globalThis.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;
      return mockFileReader;
    }

    function createFileEvent(fileName: string = 'test.json') {
      return {
        target: {
          files: [new File(['{}'], fileName, { type: 'application/json' })],
          value: fileName,
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
    }

    it('transitions to preview state on valid file', () => {
      mockParseAssetJSON.mockReturnValue({ data: VALID_EXPORT_DATA, warnings: [] });

      const { result } = renderHook(() => useAssetExportImport());
      const mockFileReader = setupFileReader(JSON.stringify(VALID_EXPORT_DATA));

      act(() => { result.current.handleFileSelect(createFileEvent()); });
      act(() => { mockFileReader.onload!(); });

      expect(result.current.importState.step).toBe('preview');
      expect(result.current.importDialogOpen).toBe(true);
      if (result.current.importState.step === 'preview') {
        expect(result.current.importState.data).toEqual(VALID_EXPORT_DATA);
        expect(result.current.importState.warnings).toEqual([]);
      }
      restoreFileReader();
    });

    it('transitions to preview state with warnings', () => {
      mockParseAssetJSON.mockReturnValue({
        data: VALID_EXPORT_DATA,
        warnings: ['duplicate product name "Test"'],
      });

      const { result } = renderHook(() => useAssetExportImport());
      const mockFileReader = setupFileReader(JSON.stringify(VALID_EXPORT_DATA));

      act(() => { result.current.handleFileSelect(createFileEvent()); });
      act(() => { mockFileReader.onload!(); });

      expect(result.current.importState.step).toBe('preview');
      if (result.current.importState.step === 'preview') {
        expect(result.current.importState.warnings).toEqual(['duplicate product name "Test"']);
      }
      restoreFileReader();
    });

    it('transitions to error state on invalid JSON', () => {
      mockParseAssetJSON.mockImplementation(() => {
        throw new Error('Invalid JSON format');
      });

      const { result } = renderHook(() => useAssetExportImport());
      const mockFileReader = setupFileReader('not json');

      act(() => { result.current.handleFileSelect(createFileEvent('bad.json')); });
      act(() => { mockFileReader.onload!(); });

      expect(result.current.importState.step).toBe('error');
      if (result.current.importState.step === 'error') {
        expect(result.current.importState.message).toBe('Invalid JSON format');
      }
      expect(result.current.importDialogOpen).toBe(true);
      restoreFileReader();
    });

    it('transitions to error state on file read error', () => {
      const { result } = renderHook(() => useAssetExportImport());
      const mockFileReader = setupFileReader('');

      act(() => { result.current.handleFileSelect(createFileEvent()); });
      act(() => { mockFileReader.onerror!(); });

      expect(result.current.importState.step).toBe('error');
      if (result.current.importState.step === 'error') {
        expect(result.current.importState.message).toBe('Failed to read file');
      }
      restoreFileReader();
    });

    it('does nothing when no file selected', () => {
      const { result } = renderHook(() => useAssetExportImport());

      const mockEvent = {
        target: { files: [], value: '' },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      act(() => { result.current.handleFileSelect(mockEvent); });

      expect(result.current.importState.step).toBe('idle');
    });
  });

  describe('import - confirm', () => {
    let originalFileReader: typeof FileReader;

    beforeEach(() => {
      originalFileReader = globalThis.FileReader;
    });

    function restoreFileReader() {
      globalThis.FileReader = originalFileReader;
    }

    function setupPreviewState(result: { current: ReturnType<typeof useAssetExportImport> }) {
      mockParseAssetJSON.mockReturnValue({ data: VALID_EXPORT_DATA, warnings: [] });

      const mockFileReader = {
        readAsText: vi.fn(),
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        result: JSON.stringify(VALID_EXPORT_DATA),
      };
      globalThis.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

      const mockEvent = {
        target: {
          files: [new File(['{}'], 'test.json')],
          value: 'test.json',
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      act(() => { result.current.handleFileSelect(mockEvent); });
      act(() => { mockFileReader.onload!(); });

      expect(result.current.importState.step).toBe('preview');
    }

    it('executes import and transitions to done state', async () => {
      const importResult = {
        products_created: 1,
        units_created: 1,
        errors: [],
        warnings: [],
      };
      mockImportAssets.mockResolvedValue(importResult);

      const { result } = renderHook(() => useAssetExportImport());
      setupPreviewState(result);

      await act(async () => {
        await result.current.handleImportConfirm();
      });

      expect(mockImportAssets).toHaveBeenCalledWith(VALID_EXPORT_DATA);
      expect(result.current.importState.step).toBe('done');
      if (result.current.importState.step === 'done') {
        expect(result.current.importState.result).toEqual(importResult);
      }
      restoreFileReader();
    });

    it('transitions to error state on import failure', async () => {
      mockImportAssets.mockRejectedValue(new Error('DB error'));

      const { result } = renderHook(() => useAssetExportImport());
      setupPreviewState(result);

      await act(async () => {
        await result.current.handleImportConfirm();
      });

      expect(result.current.importState.step).toBe('error');
      if (result.current.importState.step === 'error') {
        expect(result.current.importState.message).toBe('DB error');
      }
      restoreFileReader();
    });

    it('does nothing when not in preview state', async () => {
      const { result } = renderHook(() => useAssetExportImport());

      await act(async () => {
        await result.current.handleImportConfirm();
      });

      expect(mockImportAssets).not.toHaveBeenCalled();
      expect(result.current.importState.step).toBe('idle');
    });
  });

  describe('import - close', () => {
    it('resets state and closes dialog', () => {
      mockParseAssetJSON.mockReturnValue({ data: VALID_EXPORT_DATA, warnings: [] });

      const { result } = renderHook(() => useAssetExportImport());

      const originalFileReader = globalThis.FileReader;
      const mockFileReader = {
        readAsText: vi.fn(),
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        result: JSON.stringify(VALID_EXPORT_DATA),
      };
      globalThis.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

      const mockEvent = {
        target: {
          files: [new File(['{}'], 'test.json')],
          value: 'test.json',
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      act(() => { result.current.handleFileSelect(mockEvent); });
      act(() => { mockFileReader.onload!(); });

      expect(result.current.importDialogOpen).toBe(true);

      act(() => { result.current.handleImportClose(); });

      expect(result.current.importDialogOpen).toBe(false);
      expect(result.current.importState).toEqual({ step: 'idle' });

      globalThis.FileReader = originalFileReader;
    });
  });

  describe('triggerFileSelect', () => {
    it('calls click on file input ref', () => {
      const { result } = renderHook(() => useAssetExportImport());

      const mockClick = vi.fn();
      (result.current.fileInputRef as { current: unknown }).current = { click: mockClick };

      act(() => { result.current.triggerFileSelect(); });

      expect(mockClick).toHaveBeenCalled();
    });
  });
});
