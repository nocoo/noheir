import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { StoredYearData } from '@/hooks/useTransactions';
import { StoredTransferYearData, useTransfers } from '@/hooks/useTransfers';
import { formatCurrencyFull } from '@/lib/chart-config';
import type { DataQualityMetrics, TransactionValidation } from '@/types/data';
import { DataQuality } from '@/components/dashboard/DataQuality';
import { TransferImport } from '@/components/dashboard/TransferImport';
import { useSettings, getIncomeColor, getIncomeColorHex, getExpenseColor, getExpenseColorHex } from '@/contexts/SettingsContext';
import {
  Database,
  Calendar,
  FileText,
  TrendingUp,
  TrendingDown,
  Download,
  Trash2,
  Cloud,
  Clock,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Upload,
  X
} from 'lucide-react';

interface DataManagementProps {
  storedYearsData: StoredYearData[];
  isLoading: boolean;
  onDeleteYear: (year: number) => void;
  onClearAll: () => void;
  onExport: () => void;
  onGoToImport: () => void;
  onGoToTransferImport?: () => void;
  onViewQuality: (year: number) => void;
  qualityData?: { year: number; metrics: DataQualityMetrics; validations: TransactionValidation[] } | null;
}

// Year data completeness status
interface YearDataStatus {
  year: number;
  hasTransactions: boolean;
  hasTransfers: boolean;
  isComplete: boolean;
}

export function DataManagement({
  storedYearsData,
  isLoading,
  onDeleteYear,
  onClearAll,
  onExport,
  onGoToImport,
  onGoToTransferImport,
  onViewQuality,
  qualityData
}: DataManagementProps) {
  const { settings } = useSettings();
  const incomeColorClass = getIncomeColor(settings.colorScheme);
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);

  // Transfers data
  const {
    storedYearsData: transferYearsData,
    isLoading: transfersLoading,
    deleteYearTransfers,
    clearAllTransfers,
  } = useTransfers();

  // Dialog states
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [deleteYearDialogOpen, setDeleteYearDialogOpen] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<number | null>(null);
  const [dataTypeToDelete, setDataTypeToDelete] = useState<'transactions' | 'transfers' | 'both'>('transactions');
  const [importTransferDialogOpen, setImportTransferDialogOpen] = useState(false);
  const [yearToImportTransfer, setYearToImportTransfer] = useState<number | null>(null);

  // Calculate year data completeness
  const yearDataStatusMap = useMemo(() => {
    const statusMap = new Map<number, YearDataStatus>();

    // Add transaction years
    storedYearsData.forEach(yearData => {
      statusMap.set(yearData.year, {
        year: yearData.year,
        hasTransactions: true,
        hasTransfers: false,
        isComplete: false,
      });
    });

    // Add transfer years and update completeness
    transferYearsData.forEach(transferYear => {
      const existing = statusMap.get(transferYear.year);
      if (existing) {
        statusMap.set(transferYear.year, {
          year: transferYear.year,
          hasTransactions: true,
          hasTransfers: true,
          isComplete: true,
        });
      } else {
        statusMap.set(transferYear.year, {
          year: transferYear.year,
          hasTransactions: false,
          hasTransfers: true,
          isComplete: false,
        });
      }
    });

    return statusMap;
  }, [storedYearsData, transferYearsData]);

  // Get all unique years sorted
  const allYears = useMemo(() => {
    return Array.from(yearDataStatusMap.values()).sort((a, b) => b.year - a.year);
  }, [yearDataStatusMap]);

  // Handle clear all with confirmation
  const handleClearAllClick = () => {
    setClearAllDialogOpen(true);
  };

  const handleClearAllConfirm = () => {
    setClearAllDialogOpen(false);
    onClearAll();
    clearAllTransfers();
  };

  // Handle delete year with confirmation
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

  // Handle import transfer
  const handleImportTransfer = (year: number) => {
    if (onGoToTransferImport) {
      onGoToTransferImport();
    }
  };

  // Calculate totals
  const totalRecords = storedYearsData.reduce((sum, d) => sum + d.recordCount, 0);
  const totalIncome = storedYearsData.reduce((sum, d) => sum + d.metadata.totalIncome, 0);
  const totalExpense = storedYearsData.reduce((sum, d) => sum + d.metadata.totalExpense, 0);
  const totalTransferRecords = transferYearsData.reduce((sum, d) => sum + d.recordCount, 0);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDataStatusBadge = (status: YearDataStatus) => {
    if (status.isComplete) {
      return (
        <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
          <CheckCircle2 className="h-3 w-3" />
          完整
        </Badge>
      );
    }

    const missing = [];
    if (!status.hasTransactions) missing.push('收支流水');
    if (!status.hasTransfers) missing.push('转账数据');

    return (
      <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200">
        <XCircle className="h-3 w-3" />
        缺失: {missing.join(', ')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Cloud className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">云端数据管理</h2>
            <p className="text-muted-foreground text-sm">
              查看和管理存储在云端的财务数据
            </p>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">存储年份</p>
                <p className="text-2xl font-bold mt-1">{allYears.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">收支记录</p>
                <p className="text-2xl font-bold mt-1">{totalRecords.toLocaleString()}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总收入</p>
                <p className={`text-2xl font-bold mt-1 ${incomeColorClass}`}>
                  {formatCurrencyFull(totalIncome)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8" style={{ color: incomeColorHex, opacity: 0.5 }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总支出</p>
                <p className={`text-2xl font-bold mt-1 ${expenseColorClass}`}>
                  {formatCurrencyFull(totalExpense)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8" style={{ color: expenseColorHex, opacity: 0.5 }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">转账记录</p>
                <p className="text-2xl font-bold mt-1">{totalTransferRecords.toLocaleString()}</p>
              </div>
              <ArrowRightLeft className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={onGoToImport} variant="default" className="gap-2">
          <Cloud className="h-4 w-4" />
          导入收支流水
        </Button>
        <Button onClick={() => onGoToTransferImport && onGoToTransferImport()} variant="default" className="gap-2">
          <ArrowRightLeft className="h-4 w-4" />
          导入转账数据
        </Button>
        <Button onClick={onExport} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          导出 CSV
        </Button>
        <Button onClick={handleClearAllClick} variant="destructive" className="gap-2" disabled={allYears.length === 0}>
          <Trash2 className="h-4 w-4" />
          清空所有数据
        </Button>
      </div>

      <Separator />

      {/* Year Data List */}
      <Card>
        <CardHeader>
          <CardTitle>已存储的年份数据</CardTitle>
          <CardDescription>
            {allYears.length === 0
              ? '暂无数据，请先导入 CSV 文件'
              : `共 ${allYears.length} 个年份，需要同时导入收支流水和转账数据才算完整`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || transfersLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              正在加载数据...
            </div>
          ) : allYears.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Cloud className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无数据</p>
              <p className="text-sm mt-1">请先导入 CSV 文件</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allYears.map((status) => {
                const txData = storedYearsData.find(d => d.year === status.year);
                const tfData = transferYearsData.find(d => d.year === status.year);

                return (
                  <div
                    key={status.year}
                    className="border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="p-4 space-y-4">
                      {/* First row: Year and completeness status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-lg px-3 py-1">
                            {status.year}
                          </Badge>
                          <span className="text-sm text-muted-foreground">年</span>
                          {getDataStatusBadge(status)}
                        </div>
                      </div>

                      {/* Second row: Transaction data */}
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        {txData ? (
                          <>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1.5">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">收支流水</span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <span>{txData.recordCount.toLocaleString()} 条</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <TrendingUp className="h-4 w-4" style={{ color: incomeColorHex }} />
                                <span className={incomeColorClass}>
                                  {formatCurrencyFull(txData.metadata.totalIncome)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <TrendingDown className="h-4 w-4" style={{ color: expenseColorHex }} />
                                <span className={expenseColorClass}>
                                  {formatCurrencyFull(txData.metadata.totalExpense)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onViewQuality(status.year)}
                                className="gap-1"
                              >
                                查看质量
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteYearClick(status.year, 'transactions')}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <FileText className="h-4 w-4" />
                                <span className="font-medium">收支流水</span>
                              </div>
                              <span className="text-xs">缺失数据</span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={onGoToImport}
                              className="gap-1"
                            >
                              <Upload className="h-3 w-3" />
                              导入
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Third row: Transfer data */}
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        {tfData ? (
                          <>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1.5">
                                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">转账数据</span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <span>{tfData.recordCount.toLocaleString()} 条</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">流入:</span>
                                <span className={incomeColorClass}>
                                  {formatCurrencyFull(tfData.metadata.totalInflow)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">流出:</span>
                                <span className={expenseColorClass}>
                                  {formatCurrencyFull(tfData.metadata.totalOutflow)}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteYearClick(status.year, 'transfers')}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <ArrowRightLeft className="h-4 w-4" />
                                <span className="font-medium">转账数据</span>
                              </div>
                              <span className="text-xs">缺失数据</span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleImportTransfer(status.year)}
                              className="gap-1"
                            >
                              <Upload className="h-3 w-3" />
                              导入
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-6 text-xs text-muted-foreground pt-2 border-t">
                        {txData && (
                          <div className="flex items-center gap-1">
                            <Cloud className="h-3 w-3" />
                            <span>收支导入: {formatDate(txData.importedAt)}</span>
                          </div>
                        )}
                        {tfData && (
                          <div className="flex items-center gap-1">
                            <Cloud className="h-3 w-3" />
                            <span>转账导入: {formatDate(tfData.importedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quality View */}
      {qualityData && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{qualityData.year} 年数据质量评估</h2>
              <p className="text-muted-foreground text-sm">
                查看该年份数据的完整性和有效性
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewQuality(0)}
            >
              关闭
            </Button>
          </div>
          <DataQuality
            metrics={qualityData.metrics}
            validations={qualityData.validations}
          />
        </>
      )}

      <Card className="bg-muted/50 border-dashed">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Cloud className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <span className="font-medium">数据类型说明：</span>
                每个年份需要导入两种数据：<span className="font-medium">收支流水</span>和<span className="font-medium">转账数据</span>。只有两种数据都导入后，该年份才算完整。
              </p>
              <p>
                <span className="font-medium">数据导入规则：</span>
                按年份导入，导入新数据会自动替换该年份的旧数据。不同年份的数据可以同时存在。
              </p>
              <p>
                <span className="font-medium">建议操作：</span>
                定期使用"导出 CSV"功能，将数据导出为 CSV 文件保存到本地，作为数据备份。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <AlertDialogTitle>确认清空所有数据？</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>此操作将删除云端的所有数据（收支流水和转账），操作无法撤销。</p>
                <p className="text-sm text-muted-foreground">
                  将删除 {allYears.length} 个年份的数据，
                  {totalRecords > 0 && ` ${totalRecords.toLocaleString()} 条收支记录`}
                  {totalTransferRecords > 0 && ` ${totalTransferRecords.toLocaleString()} 条转账记录`}。
                </p>
                <p className="text-sm font-medium text-destructive">
                  建议在执行此操作前先使用"导出 CSV"功能备份您的数据。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Year Confirmation Dialog */}
      <AlertDialog open={deleteYearDialogOpen} onOpenChange={setDeleteYearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <AlertDialogTitle>
                确认删除 {yearToDelete} 年{dataTypeToDelete === 'transactions' ? '收支流水' : '转账数据'}？
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  此操作将删除 {yearToDelete} 年的{dataTypeToDelete === 'transactions' ? '收支流水数据' : '转账数据'}，操作无法撤销。
                </p>
                {dataTypeToDelete === 'transactions' && (() => {
                  const yearData = storedYearsData.find(d => d.year === yearToDelete);
                  return yearData ? (
                    <p className="text-sm text-muted-foreground">
                      将删除 {yearData.recordCount.toLocaleString()} 条收支记录。
                    </p>
                  ) : null;
                })()}
                {dataTypeToDelete === 'transfers' && (() => {
                  const yearData = transferYearsData.find(d => d.year === yearToDelete);
                  return yearData ? (
                    <p className="text-sm text-muted-foreground">
                      将删除 {yearData.recordCount.toLocaleString()} 条转账记录。
                    </p>
                  ) : null;
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteYearConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Transfer Dialog */}
      <AlertDialog open={importTransferDialogOpen} onOpenChange={setImportTransferDialogOpen}>
        <AlertDialogContent className="max-w-4xl">
          <div className="flex items-center justify-between mb-4">
            <AlertDialogHeader>
              <AlertDialogTitle>导入转账数据</AlertDialogTitle>
            </AlertDialogHeader>
            <Button variant="ghost" size="icon" onClick={() => setImportTransferDialogOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {yearToImportTransfer && (
            <TransferImport
              year={yearToImportTransfer}
              onUploadComplete={() => {
                setImportTransferDialogOpen(false);
                setYearToImportTransfer(null);
              }}
              onClose={() => {
                setImportTransferDialogOpen(false);
                setYearToImportTransfer(null);
              }}
            />
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
