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
import { StoredYearData } from '@/hooks/useTransactions';
import { formatCurrencyFull } from '@/lib/chart-config';
import type { DataQualityMetrics, TransactionValidation } from '@/types/data';
import { DataQuality } from '@/components/dashboard/DataQuality';
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
  AlertTriangle
} from 'lucide-react';

interface DataManagementProps {
  storedYearsData: StoredYearData[];
  isLoading: boolean;
  onDeleteYear: (year: number) => void;
  onClearAll: () => void;
  onExport: () => void;
  onGoToImport: () => void;
  onViewQuality: (year: number) => void;
  qualityData?: { year: number; metrics: DataQualityMetrics; validations: TransactionValidation[] } | null;
}

export function DataManagement({
  storedYearsData,
  isLoading,
  onDeleteYear,
  onClearAll,
  onExport,
  onGoToImport,
  onViewQuality,
  qualityData
}: DataManagementProps) {
  const { settings } = useSettings();
  const incomeColorClass = getIncomeColor(settings.colorScheme);
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);

  // Dialog states
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [deleteYearDialogOpen, setDeleteYearDialogOpen] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<number | null>(null);

  // Handle clear all with confirmation
  const handleClearAllClick = () => {
    setClearAllDialogOpen(true);
  };

  const handleClearAllConfirm = () => {
    setClearAllDialogOpen(false);
    onClearAll();
  };

  // Handle delete year with confirmation
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

  // Calculate totals
  const totalRecords = storedYearsData.reduce((sum, d) => sum + d.recordCount, 0);
  const totalIncome = storedYearsData.reduce((sum, d) => sum + d.metadata.totalIncome, 0);
  const totalExpense = storedYearsData.reduce((sum, d) => sum + d.metadata.totalExpense, 0);

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
                <p className="text-sm text-muted-foreground">总记录数</p>
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
          导入新数据
        </Button>
        <Button onClick={onExport} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          导出 CSV
        </Button>
        <Button onClick={handleClearAllClick} variant="destructive" className="gap-2" disabled={storedYearsData.length === 0}>
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
            {storedYearsData.length === 0
              ? '暂无数据，请先导入 CSV 文件'
              : `共 ${storedYearsData.length} 个年份，${totalRecords} 条记录`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              正在加载数据...
            </div>
          ) : storedYearsData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Cloud className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无数据</p>
              <p className="text-sm mt-1">请在"数据导入"页面上传 CSV 文件</p>
            </div>
          ) : (
            <div className="space-y-3">
              {storedYearsData
                .sort((a, b) => b.year - a.year)
                .map((yearData) => (
                  <div
                    key={yearData.year}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 space-y-3">
                      {/* Year and basic info */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-lg px-3 py-1">
                            {yearData.year}
                          </Badge>
                          <span className="text-sm text-muted-foreground">年</span>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            <span>{yearData.recordCount.toLocaleString()} 条记录</span>
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
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-6 text-xs text-muted-foreground pl-2">
                        <div className="flex items-center gap-1">
                          <Cloud className="h-3 w-3" />
                          <span>云端存储</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>导入: {formatDate(yearData.importedAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
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
                        删除
                      </Button>
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

      <Card className="bg-muted/50 border-dashed">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Cloud className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <span className="font-medium">数据存储方式：</span>
                所有数据存储在 Supabase 云端数据库中，支持多设备同步访问。
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
            <AlertDialogDescription className="space-y-2">
              <p>此操作将删除云端的所有数据，操作无法撤销。</p>
              <p className="text-sm text-muted-foreground">
                将删除 {storedYearsData.length} 个年份的数据，共 {totalRecords.toLocaleString()} 条记录。
              </p>
              <p className="text-sm font-medium text-destructive">
                建议在执行此操作前先使用"导出 CSV"功能备份您的数据。
              </p>
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
              <AlertDialogTitle>确认删除 {yearToDelete} 年数据？</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2">
              <p>此操作将删除 {yearToDelete} 年的所有数据，操作无法撤销。</p>
              {(() => {
                const yearData = storedYearsData.find(d => d.year === yearToDelete);
                return yearData ? (
                  <p className="text-sm text-muted-foreground">
                    将删除 {yearData.recordCount.toLocaleString()} 条记录。
                  </p>
                ) : null;
              })()}
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
