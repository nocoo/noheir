import { useMemo, useState } from 'react';
import { useTransfers } from '@/hooks/useTransfers';
import type { StoredYearData } from '@/hooks/useTransactions';
import type { DataQualityMetrics, TransactionValidation } from '@/types/data';
import {
  buildYearStatusMap,
  calculateTotals,
  formatImportDate,
  getAllYears,
  YearDataStatus,
} from '@/domain/dataManagement';

type DataManagementProps = {
  storedYearsData: StoredYearData[];
  isLoading: boolean;
  onDeleteYear: (year: number) => void;
  onClearAll: () => void;
  onExport: () => void;
  onGoToImport: () => void;
  onGoToTransferImport?: () => void;
  onViewQuality: (year: number) => void;
  qualityData?: { year: number; metrics: DataQualityMetrics; validations: TransactionValidation[] } | null;
};

export function useDataManagementViewModel(props: DataManagementProps) {
  const {
    storedYearsData,
    onDeleteYear,
    onClearAll,
    onGoToTransferImport,
  } = props;

  const {
    storedYearsData: transferYearsData,
    isLoading: transfersLoading,
    deleteYearTransfers,
    clearAllTransfers,
  } = useTransfers();

  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [deleteYearDialogOpen, setDeleteYearDialogOpen] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<number | null>(null);
  const [dataTypeToDelete, setDataTypeToDelete] = useState<'transactions' | 'transfers' | 'both'>('transactions');
  const [importTransferDialogOpen, setImportTransferDialogOpen] = useState(false);
  const [yearToImportTransfer, setYearToImportTransfer] = useState<number | null>(null);

  const yearDataStatusMap = useMemo(() => {
    return buildYearStatusMap(storedYearsData, transferYearsData);
  }, [storedYearsData, transferYearsData]);

  const allYears = useMemo(() => getAllYears(yearDataStatusMap), [yearDataStatusMap]);

  const { totalRecords, totalIncome, totalExpense, totalTransferRecords } = useMemo(
    () => calculateTotals(storedYearsData, transferYearsData),
    [storedYearsData, transferYearsData]
  );

  const handleClearAllClick = () => {
    setClearAllDialogOpen(true);
  };

  const handleClearAllConfirm = () => {
    setClearAllDialogOpen(false);
    onClearAll();
    clearAllTransfers();
  };

  const handleDeleteYearClick = (year: number, dataType: 'transactions' | 'transfers') => {
    setYearToDelete(year);
    setDataTypeToDelete(dataType);
    setDeleteYearDialogOpen(true);
  };

  const handleDeleteYearConfirm = () => {
    setDeleteYearDialogOpen(false);
    if (yearToDelete !== null) {
      if (dataTypeToDelete === 'transactions') {
        onDeleteYear(yearToDelete);
      } else if (dataTypeToDelete === 'transfers') {
        deleteYearTransfers(yearToDelete);
      }
      setYearToDelete(null);
    }
  };

  const handleImportTransfer = (year: number) => {
    if (onGoToTransferImport) {
      onGoToTransferImport();
      return;
    }

    setYearToImportTransfer(year);
    setImportTransferDialogOpen(true);
  };

  const getDataStatusBadge = (status: YearDataStatus) => {
    return status;
  };

  return {
    transferYearsData,
    transfersLoading,
    yearDataStatusMap,
    allYears,
    totalRecords,
    totalIncome,
    totalExpense,
    totalTransferRecords,
    clearAllDialogOpen,
    deleteYearDialogOpen,
    yearToDelete,
    dataTypeToDelete,
    importTransferDialogOpen,
    yearToImportTransfer,
    setClearAllDialogOpen,
    setDeleteYearDialogOpen,
    setImportTransferDialogOpen,
    setYearToImportTransfer,
    handleClearAllClick,
    handleClearAllConfirm,
    handleDeleteYearClick,
    handleDeleteYearConfirm,
    handleImportTransfer,
    formatImportDate,
    getDataStatusBadge,
  };
}
