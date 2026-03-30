import { useState, useCallback, useRef } from 'react';
import {
  exportProducts,
  parseProductJSON,
  importProducts,
  type ProductExportData,
  type ProductImportResult,
} from '@/services/assetService';

export type ProductImportState =
  | { step: 'idle' }
  | { step: 'preview'; data: ProductExportData; warnings: string[] }
  | { step: 'importing' }
  | { step: 'done'; result: ProductImportResult }
  | { step: 'error'; message: string };

export function useProductExportImport() {
  const [exporting, setExporting] = useState(false);
  const [importState, setImportState] = useState<ProductImportState>({ step: 'idle' });
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Export ──────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const data = await exportProducts();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `noheir-products-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[ProductExportImport] Export failed:', error);
    } finally {
      setExporting(false);
    }
  }, []);

  // ── Import: file selection ─────────────────────────────────────────────

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      try {
        const { data, warnings } = parseProductJSON(text);
        setImportState({ step: 'preview', data, warnings });
        setImportDialogOpen(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown parse error';
        setImportState({ step: 'error', message });
        setImportDialogOpen(true);
      }
    };
    reader.onerror = () => {
      setImportState({ step: 'error', message: 'Failed to read file' });
      setImportDialogOpen(true);
    };
    reader.readAsText(file);

    event.target.value = '';
  }, []);

  // ── Import: confirm ────────────────────────────────────────────────────

  const handleImportConfirm = useCallback(async () => {
    if (importState.step !== 'preview') return;

    const { data } = importState;
    setImportState({ step: 'importing' });

    try {
      const result = await importProducts(data);
      setImportState({ step: 'done', result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown import error';
      setImportState({ step: 'error', message });
    }
  }, [importState]);

  // ── Import: cancel / close ─────────────────────────────────────────────

  const handleImportClose = useCallback(() => {
    setImportDialogOpen(false);
    setImportState({ step: 'idle' });
  }, []);

  return {
    exporting,
    handleExport,
    importState,
    importDialogOpen,
    fileInputRef,
    triggerFileSelect,
    handleFileSelect,
    handleImportConfirm,
    handleImportClose,
  };
}
