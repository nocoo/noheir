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
import { DataQuality } from '@/components/dashboard/DataQuality';
import { useSettings, getIncomeColor, getIncomeColorHex, getExpenseColor, getExpenseColorHex } from '@/contexts/SettingsContext';
import { formatImportDate } from '@/domain/dataManagement';
import { formatCurrencyFull } from '@/lib/chart-config';
import type { StoredYearData } from '@/hooks/useTransactions';
import type { DataQualityMetrics, TransactionValidation } from '@/types/data';
import {
  Calendar,
  FileText,
  TrendingUp,
  TrendingDown,
  Download,
  Trash2,
  Cloud,
  ChevronRight,
  Upload,
  AlertTriangle,
} from 'lucide-react';

interface TransactionDataTabProps {
  storedYearsData: StoredYearData[];
  isLoading: boolean;
  onDeleteYear: (year: number) => void;
  onClearAll: () => void;
  onExport: () => void;
  onGoToImport: () => void;
  onViewQuality: (year: number) => void;
  qualityData?: { year: number; metrics: DataQualityMetrics; validations: TransactionValidation[] } | null;
}

export function TransactionDataTab({
  storedYearsData,
  isLoading,
  onDeleteYear,
  onClearAll,
  onExport,
  onGoToImport,
  onViewQuality,
  qualityData,
}: TransactionDataTabProps) {
  const { settings } = useSettings();
  const incomeColorClass = getIncomeColor(settings.colorScheme);
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);

  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [deleteYearDialogOpen, setDeleteYearDialogOpen] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<number | null>(null);

  const totalRecords = storedYearsData.reduce((sum, d) => sum + d.recordCount, 0);
  const totalIncome = storedYearsData.reduce((sum, d) => sum + d.metadata.totalIncome, 0);
  const totalExpense = storedYearsData.reduce((sum, d) => sum + d.metadata.totalExpense, 0);
  const sortedYears = [...storedYearsData].sort((a, b) => b.year - a.year);

  const handleClearAllConfirm = () => {
    setClearAllDialogOpen(false);
    onClearAll();
  };

  const handleDeleteYearClick = (year: number) => {
    setYearToDelete(year);
    setDeleteYearDialogOpen(true);
  };

  const handleDeleteYearConfirm = () => {
    setDeleteYearDialogOpen(false);
    if (yearToDelete !== null) {
      onDeleteYear(yearToDelete);
      setYearToDelete(null);
    }
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
                <p className="text-2xl font-bold mt-1">{storedYearsData.length}</p>
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
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={onGoToImport} variant="default" className="gap-2">
          <Cloud className="h-4 w-4" />
          导入收支流水
        </Button>
        <Button onClick={onExport} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          导出 CSV
        </Button>
        <Button onClick={() => setClearAllDialogOpen(true)} variant="destructive" className="gap-2" disabled={storedYearsData.length === 0}>
          <Trash2 className="h-4 w-4" />
          清空收支数据
        </Button>
      </div>

      <Separator />

      {/* Year Data List */}
      <Card>
        <CardHeader>
          <CardTitle>已存储的年份数据</CardTitle>
          <CardDescription>
            {storedYearsData.length === 0
              ? '暂无数据，请先导入 CSV 文件'
              : `共 ${storedYearsData.length} 个年份的收支流水数据`}
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
              <p>暂无收支流水数据</p>
              <p className="text-sm mt-1">请先导入 CSV 文件</p>
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
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{yearData.recordCount.toLocaleString()} 条</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" style={{ color: incomeColorHex }} />
                          <span className={incomeColorClass}>
                            {formatCurrencyFull(yearData.metadata.totalIncome)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingDown className="h-4 w-4" style={{ color: expenseColorHex }} />
                          <span className={expenseColorClass}>
                            {formatCurrencyFull(yearData.metadata.totalExpense)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewQuality(yearData.year)}
                          className="gap-1"
                        >
                          查看质量
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteYearClick(yearData.year)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

      {/* Info Card */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Cloud className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-2">
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

      {/* Clear All Dialog */}
      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <AlertDialogTitle>确认清空所有收支数据？</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>此操作将删除云端的所有收支流水数据，操作无法撤销。</p>
                <p className="text-sm text-muted-foreground">
                  将删除 {storedYearsData.length} 个年份的数据，共 {totalRecords.toLocaleString()} 条收支记录。
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

      {/* Delete Year Dialog */}
      <AlertDialog open={deleteYearDialogOpen} onOpenChange={setDeleteYearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <AlertDialogTitle>确认删除 {yearToDelete} 年收支流水？</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>此操作将删除 {yearToDelete} 年的收支流水数据，操作无法撤销。</p>
                {(() => {
                  const yearData = storedYearsData.find(d => d.year === yearToDelete);
                  return yearData ? (
                    <p className="text-sm text-muted-foreground">
                      将删除 {yearData.recordCount.toLocaleString()} 条收支记录。
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
    </div>
  );
}
