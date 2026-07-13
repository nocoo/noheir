"use client";

import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  FileText,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { clearAllData, exportBackup, restoreBackup } from "@/app/actions/data-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { DataHealthMetrics, DataSummary } from "@/domain/data-management";
import {
  formatCurrency,
  getHealthColorClass,
  getHealthLabel,
  getHealthScore,
} from "@/domain/data-management";

interface ManageClientProps {
  dataSummary: DataSummary;
  healthMetrics: DataHealthMetrics;
}

export function ManageClient({ dataSummary, healthMetrics }: ManageClientProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  const healthScore = getHealthScore(healthMetrics);
  const healthLabel = getHealthLabel(healthScore);
  const healthColor = getHealthColorClass(healthScore);

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportBackup();
      if (result.success) {
        const json = JSON.stringify(result.data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `noheir-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("数据已导出");
      } else {
        toast.error(result.error);
      }
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      const transactions = Array.isArray(data.transactions) ? data.transactions : [];
      const transfers = Array.isArray(data.transfers) ? data.transfers : [];

      const result = await restoreBackup({ transactions, transfers });
      if (result.success) {
        toast.success(
          `导入完成: ${result.data.transactions}条交易, ${result.data.transfers}条转账`,
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("文件解析失败，请确保是有效的 JSON 备份文件");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleClear = () => {
    setClearOpen(true);
  };

  const confirmClear = () => {
    startTransition(async () => {
      const result = await clearAllData();
      if (result.success) {
        toast.success("所有数据已清除");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setClearOpen(false);
    });
  };

  const hasData = dataSummary.totalTransactions > 0 || dataSummary.totalTransfers > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Database className="text-primary size-6" />
          数据管理
        </h1>
        <p className="text-muted-foreground text-sm">查看数据概览、导出备份与管理数据</p>
      </div>

      {/* Overall Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">数据总览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div>
              <p className="text-xs text-muted-foreground">覆盖年份</p>
              <p className="text-2xl font-semibold font-display">{dataSummary.years.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">交易记录</p>
              <p className="text-2xl font-semibold font-display">
                {dataSummary.totalTransactions.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">转账记录</p>
              <p className="text-2xl font-semibold font-display">
                {dataSummary.totalTransfers.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">总收入</p>
              <p className="text-xl font-semibold font-display text-income">
                {formatCurrency(dataSummary.totalIncome)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">总支出</p>
              <p className="text-xl font-semibold font-display text-expense">
                {formatCurrency(dataSummary.totalExpense)}
              </p>
            </div>
          </div>

          {dataSummary.totalAccounts.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    资金账户 ({dataSummary.totalAccounts.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {dataSummary.totalAccounts.slice(0, 10).map((acc) => (
                      <Badge key={acc} variant="secondary" className="text-xs">
                        {acc}
                      </Badge>
                    ))}
                    {dataSummary.totalAccounts.length > 10 && (
                      <Badge variant="outline" className="text-xs">
                        +{dataSummary.totalAccounts.length - 10}
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    一级分类 ({dataSummary.totalCategories.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {dataSummary.totalCategories.slice(0, 12).map((cat) => (
                      <Badge key={cat} variant="outline" className="text-xs">
                        {cat}
                      </Badge>
                    ))}
                    {dataSummary.totalCategories.length > 12 && (
                      <Badge variant="outline" className="text-xs">
                        +{dataSummary.totalCategories.length - 12}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Data Health Card */}
      {hasData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4" />
              数据健康度
            </CardTitle>
            <CardDescription>数据完整性和有效性评估</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 mb-6">
              <div className={`text-5xl font-semibold font-display ${healthColor}`}>
                {healthScore.toFixed(0)}%
              </div>
              <div className="flex-1 space-y-2">
                <Progress value={healthScore} className="h-2" />
                <p className={`text-sm font-medium ${healthColor}`}>数据质量{healthLabel}</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="gap-1 text-xs">
                    <FileText className="size-3" />
                    {healthMetrics.totalRecords} 条记录
                  </Badge>
                  {healthMetrics.missingDates > 0 && (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <XCircle className="size-3" />
                      {healthMetrics.missingDates} 无效日期
                    </Badge>
                  )}
                  {healthMetrics.zeroAmounts > 0 && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <AlertTriangle className="size-3" />
                      {healthMetrics.zeroAmounts} 零金额
                    </Badge>
                  )}
                  {healthMetrics.missingDates === 0 && healthMetrics.zeroAmounts === 0 && (
                    <Badge
                      variant="outline"
                      className="gap-1 text-xs text-green-600 dark:text-green-400"
                    >
                      <CheckCircle className="size-3" />
                      无异常
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Completeness Bars */}
            <div className="grid gap-3 md:grid-cols-2">
              <CompletenessBar
                name="日期完整性"
                percentage={healthMetrics.dateCompleteness}
                icon={Calendar}
              />
              <CompletenessBar
                name="分类完整性"
                percentage={healthMetrics.categoryCompleteness}
                icon={Tag}
              />
              <CompletenessBar
                name="金额有效性"
                percentage={healthMetrics.amountCompleteness}
                icon={FileText}
              />
              <CompletenessBar
                name="账户信息"
                percentage={healthMetrics.accountCompleteness}
                icon={Wallet}
              />
            </div>

            {/* Category Mapping Warning */}
            {healthMetrics.missingSecondaryMappings > 0 && (
              <div className="mt-4 p-3 rounded-[var(--radius-card)] bg-secondary border border-yellow-500/50">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 font-medium mb-2">
                  <AlertTriangle className="size-4" />
                  分类映射缺失
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {healthMetrics.missingSecondaryMappings} 条记录的三级分类未找到对应的二级分类映射
                </p>
                <div className="flex flex-wrap gap-1">
                  {healthMetrics.unmappedTertiaryCategories.slice(0, 8).map((cat) => (
                    <Badge
                      key={cat}
                      variant="outline"
                      className="text-xs border-yellow-500/50 text-yellow-700 dark:text-yellow-400"
                    >
                      {cat}
                    </Badge>
                  ))}
                  {healthMetrics.unmappedTertiaryCategories.length > 8 && (
                    <Badge variant="outline" className="text-xs">
                      +{healthMetrics.unmappedTertiaryCategories.length - 8}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Yearly Breakdown */}
      {dataSummary.yearlyStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">年度数据明细</CardTitle>
            <CardDescription>点击展开查看每年详细统计</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {dataSummary.yearlyStats.map((stats) => (
              <Collapsible
                key={stats.year}
                open={expandedYears.has(stats.year)}
                onOpenChange={() => toggleYear(stats.year)}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 rounded-[var(--radius-card)] border hover:bg-secondary cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <Badge variant="default" className="text-sm font-semibold">
                        {stats.year}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {stats.transactionCount} 条交易
                        {stats.transferCount > 0 && ` / ${stats.transferCount} 条转账`}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-income">
                        +{formatCurrency(stats.totalIncome)}
                      </span>
                      <span className="text-sm font-medium text-expense">
                        -{formatCurrency(stats.totalExpense)}
                      </span>
                      {expandedYears.has(stats.year) ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-4 rounded-[var(--radius-card)] bg-secondary space-y-4">
                    {/* Year Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">收入笔数</p>
                        <p className="text-lg font-semibold font-display text-income">
                          {stats.incomeCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">支出笔数</p>
                        <p className="text-lg font-semibold font-display text-expense">
                          {stats.expenseCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">净收入</p>
                        <p
                          className={`text-lg font-semibold font-display ${stats.netAmount >= 0 ? "text-income" : "text-expense"}`}
                        >
                          {formatCurrency(stats.netAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">覆盖月份</p>
                        <p className="text-lg font-semibold font-display">
                          {stats.monthsCovered.length}/12
                        </p>
                      </div>
                    </div>

                    {/* Date Range */}
                    {stats.dateRange && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="size-4" />
                        <span>
                          数据范围: {stats.dateRange.start} ~ {stats.dateRange.end}
                        </span>
                      </div>
                    )}

                    {/* Accounts & Categories */}
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          涉及账户 ({stats.accountCount})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {stats.accounts.slice(0, 6).map((acc) => (
                            <Badge key={acc} variant="secondary" className="text-xs">
                              {acc}
                            </Badge>
                          ))}
                          {stats.accounts.length > 6 && (
                            <Badge variant="outline" className="text-xs">
                              +{stats.accounts.length - 6}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          一级分类 ({stats.categoryCount})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {stats.categories.slice(0, 8).map((cat) => (
                            <Badge key={cat} variant="outline" className="text-xs">
                              {cat}
                            </Badge>
                          ))}
                          {stats.categories.length > 8 && (
                            <Badge variant="outline" className="text-xs">
                              +{stats.categories.length - 8}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Months Heatmap */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">月份覆盖情况</p>
                      <div className="flex gap-1">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                          <div
                            key={month}
                            className={`w-6 h-6 rounded text-xs flex items-center justify-center ${
                              stats.monthsCovered.includes(month)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {month}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons - 3 columns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">数据操作</CardTitle>
          <CardDescription>导出备份、导入数据</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Button onClick={handleExport} disabled={exporting} className="w-full">
              <Download className="mr-2 size-4" />
              {exporting ? "导出中..." : "导出 JSON 备份"}
            </Button>
            <Button
              variant="outline"
              onClick={handleImportClick}
              disabled={importing}
              className="w-full"
            >
              <Upload className="mr-2 size-4" />
              {importing ? "导入中..." : "导入备份文件"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleFileSelected}
              className="hidden"
            />
            <Button variant="outline" onClick={() => router.push("/import")} className="w-full">
              <TrendingUp className="mr-2 size-4" />
              导入交易/转账
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="size-4" />
            危险操作
          </CardTitle>
          <CardDescription>以下操作不可撤销，请谨慎操作</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleClear} disabled={isPending}>
            <Trash2 className="mr-2 size-4" />
            清除所有数据
          </Button>
        </CardContent>
      </Card>

      {/* Clear Confirmation */}
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="清除所有数据"
        description="确定要删除所有交易记录、转账记录、产品和资本单位吗？此操作不可撤销！"
        onConfirm={confirmClear}
        loading={isPending}
      />
    </div>
  );
}

// ── Helper Components ──

function CompletenessBar({
  name,
  percentage,
  icon: Icon,
}: {
  name: string;
  percentage: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  // Use fixed colors: green=good, yellow=warning, red=bad
  // (not semantic income/expense which can swap)
  const getColor = (p: number) => {
    if (p >= 95) return "bg-green-500";
    if (p >= 80) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className="size-3 text-muted-foreground" />
          <span className="text-xs">{name}</span>
        </div>
        <span className="text-xs font-medium">{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor(percentage)} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
