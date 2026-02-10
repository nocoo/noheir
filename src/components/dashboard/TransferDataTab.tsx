import { useState } from 'react';
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
import { TransferImport } from '@/components/dashboard/TransferImport';
import { useSettings, getIncomeColor, getIncomeColorHex, getExpenseColor, getExpenseColorHex } from '@/contexts/SettingsContext';
import { useTransfers } from '@/hooks/useTransfers';
import { formatImportDate } from '@/domain/dataManagement';
import { formatCurrencyFull } from '@/lib/chart-config';
import {
  Calendar,
  ArrowRightLeft,
  Download,
  Trash2,
  Cloud,
  Upload,
  X,
  AlertTriangle,
} from 'lucide-react';

export function TransferDataTab() {
  const { settings } = useSettings();
  const incomeColorClass = getIncomeColor(settings.colorScheme);
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);

  const {
    storedYearsData: transferYearsData,
    isLoading,
    deleteYearTransfers,
    clearAllTransfers,
    exportTransfers,
  } = useTransfers();

  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [deleteYearDialogOpen, setDeleteYearDialogOpen] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<number | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [yearToImport, setYearToImport] = useState<number | null>(null);

  const totalRecords = transferYearsData.reduce((sum, d) => sum + d.recordCount, 0);
  const totalInflow = transferYearsData.reduce((sum, d) => sum + d.metadata.totalInflow, 0);
  const totalOutflow = transferYearsData.reduce((sum, d) => sum + d.metadata.totalOutflow, 0);
  const sortedYears = [...transferYearsData].sort((a, b) => b.year - a.year);

  const handleClearAllConfirm = () => {
    setClearAllDialogOpen(false);
    clearAllTransfers();
  };

  const handleDeleteYearClick = (year: number) => {
    setYearToDelete(year);
    setDeleteYearDialogOpen(true);
  };

  const handleDeleteYearConfirm = () => {
    setDeleteYearDialogOpen(false);
    if (yearToDelete !== null) {
      deleteYearTransfers(yearToDelete);
      setYearToDelete(null);
    }
  };

  const handleImportClick = (year?: number) => {
    setYearToImport(year ?? null);
    setImportDialogOpen(true);
  };

  const handleExportCSV = () => {
    const csv = exportTransfers();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noheir-transfers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">存储年份</p>
                <p className="text-2xl font-bold mt-1">{transferYearsData.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">转账记录</p>
                <p className="text-2xl font-bold mt-1">{totalRecords.toLocaleString()}</p>
              </div>
              <ArrowRightLeft className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总流入</p>
                <p className={`text-2xl font-bold mt-1 ${incomeColorClass}`}>
                  {formatCurrencyFull(totalInflow)}
                </p>
              </div>
              <ArrowRightLeft className="h-8 w-8" style={{ color: incomeColorHex, opacity: 0.5 }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总流出</p>
                <p className={`text-2xl font-bold mt-1 ${expenseColorClass}`}>
                  {formatCurrencyFull(totalOutflow)}
                </p>
              </div>
              <ArrowRightLeft className="h-8 w-8" style={{ color: expenseColorHex, opacity: 0.5 }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={() => handleImportClick()} variant="default" className="gap-2">
          <Upload className="h-4 w-4" />
          导入转账数据
        </Button>
        <Button onClick={handleExportCSV} variant="outline" className="gap-2" disabled={totalRecords === 0}>
          <Download className="h-4 w-4" />
          导出 CSV
        </Button>
        <Button onClick={() => setClearAllDialogOpen(true)} variant="destructive" className="gap-2" disabled={transferYearsData.length === 0}>
          <Trash2 className="h-4 w-4" />
          清空转账数据
        </Button>
      </div>

      <Separator />

      {/* Year Data List */}
      <Card>
        <CardHeader>
          <CardTitle>已存储的年份数据</CardTitle>
          <CardDescription>
            {transferYearsData.length === 0
              ? '暂无数据，请先导入转账 CSV 文件'
              : `共 ${transferYearsData.length} 个年份的转账数据`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              正在加载数据...
            </div>
          ) : sortedYears.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Cloud className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无转账数据</p>
              <p className="text-sm mt-1">请先导入转账 CSV 文件</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedYears.map((yearData) => (
                <div
                  key={yearData.year}
                  className="border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="p-4 space-y-3">
                    {/* Year header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-lg px-3 py-1">
                          {yearData.year}
                        </Badge>
                        <span className="text-sm text-muted-foreground">年</span>
                      </div>
                    </div>

                    {/* Data row */}
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{yearData.recordCount.toLocaleString()} 条</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">流入:</span>
                          <span className={incomeColorClass}>
                            {formatCurrencyFull(yearData.metadata.totalInflow)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">流出:</span>
                          <span className={expenseColorClass}>
                            {formatCurrencyFull(yearData.metadata.totalOutflow)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteYearClick(yearData.year)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-6 text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Cloud className="h-3 w-3" />
                        <span>导入: {formatImportDate(yearData.importedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Cloud className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <span className="font-medium">转账数据：</span>
                记录账户之间的资金流转，包括银行转账、支付账户充值等。
              </p>
              <p>
                <span className="font-medium">数据导入规则：</span>
                按年份导入，导入新数据会自动替换该年份的旧数据。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clear All Dialog */}
      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <AlertDialogTitle>确认清空所有转账数据？</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>此操作将删除云端的所有转账数据，操作无法撤销。</p>
                <p className="text-sm text-muted-foreground">
                  将删除 {transferYearsData.length} 个年份的数据，共 {totalRecords.toLocaleString()} 条转账记录。
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

      {/* Delete Year Dialog */}
      <AlertDialog open={deleteYearDialogOpen} onOpenChange={setDeleteYearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <AlertDialogTitle>确认删除 {yearToDelete} 年转账数据？</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>此操作将删除 {yearToDelete} 年的转账数据，操作无法撤销。</p>
                {(() => {
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
      <AlertDialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <AlertDialogContent className="max-w-4xl">
          <div className="flex items-center justify-between mb-4">
            <AlertDialogHeader>
              <AlertDialogTitle>导入转账数据</AlertDialogTitle>
            </AlertDialogHeader>
            <Button variant="ghost" size="icon" onClick={() => setImportDialogOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <TransferImport
            year={yearToImport ?? new Date().getFullYear()}
            onUploadComplete={() => {
              setImportDialogOpen(false);
              setYearToImport(null);
            }}
            onClose={() => {
              setImportDialogOpen(false);
              setYearToImport(null);
            }}
          />
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
