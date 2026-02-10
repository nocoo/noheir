import { useState, useCallback, useRef } from 'react';
import {
  exportAssets,
  parseAssetJSON,
  importAssets,
  type AssetExportData,
  type AssetImportResult,
} from '@/services/assetService';

export type AssetImportState =
  | { step: 'idle' }
  | { step: 'preview'; data: AssetExportData; warnings: string[] }
  | { step: 'importing' }
  | { step: 'done'; result: AssetImportResult }
  | { step: 'error'; message: string };

export function useAssetExportImport() {
  const [exporting, setExporting] = useState(false);
  const [importState, setImportState] = useState<AssetImportState>({ step: 'idle' });
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Export ──────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const data = await exportAssets();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `noheir-assets-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[AssetExportImport] Export failed:', error);
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
        const { data, warnings } = parseAssetJSON(text);
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

    // Reset input so re-selecting the same file triggers onChange
    event.target.value = '';
  }, []);

  // ── Import: confirm ────────────────────────────────────────────────────

  const handleImportConfirm = useCallback(async () => {
    if (importState.step !== 'preview') return;

    const { data } = importState;
    setImportState({ step: 'importing' });

    try {
      const result = await importAssets(data);
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
    // Export
    exporting,
    handleExport,

    // Import
    importState,
    importDialogOpen,
    fileInputRef,
    triggerFileSelect,
    handleFileSelect,
    handleImportConfirm,
    handleImportClose,
  };
}
