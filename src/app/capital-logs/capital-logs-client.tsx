"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteContributionLog,
  restoreContributionLog,
} from "@/app/actions/contribution-log-actions";
import { ContributionLogForm } from "@/components/capital/contribution-log-form";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductBadge, UnitCodeBadge } from "@/components/ui/colored-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ContributionOperationType,
  DomainContributionLog,
  DomainProduct,
  DomainUnit,
} from "@/domain/types";
import { formatCurrencyFull } from "@/lib/chart-config";
import { CAPITAL_TABLE_COLUMNS } from "@/lib/table-columns";

interface CapitalLogsClientProps {
  logs: DomainContributionLog[];
  units: DomainUnit[];
  products: DomainProduct[];
}

const OPERATION_TYPES = [
  { value: "invest", label: "投入", icon: ArrowDownLeft, color: "text-green-600" },
  { value: "withdraw", label: "取出", icon: ArrowUpRight, color: "text-red-600" },
  { value: "adjust", label: "调整", icon: Settings2, color: "text-blue-600" },
] as const;

const SOURCES = [
  { value: "manual", label: "手动录入" },
  { value: "auto", label: "自动记录" },
  { value: "import", label: "数据迁移" },
  { value: "mcp", label: "AI 助手" },
] as const;

function getOperationDisplay(type: ContributionOperationType) {
  return OPERATION_TYPES.find((t) => t.value === type) ?? OPERATION_TYPES[0];
}

function getSourceLabel(source: string) {
  return SOURCES.find((s) => s.value === source)?.label ?? source;
}

export function CapitalLogsClient({ logs: initialLogs, units, products }: CapitalLogsClientProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [isPending, startTransition] = useTransition();

  // Filter state
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [showDeleted, setShowDeleted] = useState(false);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<DomainContributionLog | null>(null);

  const activeFilterCount =
    [filterUnit, filterProduct, filterType, filterSource].filter((f) => f !== "all").length +
    (showDeleted ? 1 : 0);

  const resetFilters = () => {
    setFilterUnit("all");
    setFilterProduct("all");
    setFilterType("all");
    setFilterSource("all");
    setShowDeleted(false);
  };

  // Filter and compute stats
  const { filteredLogs, stats } = useMemo(() => {
    const filtered = logs.filter((log) => {
      if (!showDeleted && log.isDeleted) return false;
      if (filterUnit !== "all" && log.unitId !== filterUnit) return false;
      if (filterProduct !== "all" && log.productId !== filterProduct) return false;
      if (filterType !== "all" && log.operationType !== filterType) return false;
      if (filterSource !== "all" && log.source !== filterSource) return false;
      return true;
    });

    // Compute stats from non-deleted logs only
    const activeLogs = filtered.filter((l) => !l.isDeleted);
    const totalInvested = activeLogs
      .filter((l) => l.amount > 0)
      .reduce((sum, l) => sum + l.amount, 0);
    const totalWithdrawn = activeLogs
      .filter((l) => l.amount < 0)
      .reduce((sum, l) => sum + Math.abs(l.amount), 0);

    const totalPnl = activeLogs.reduce((sum, l) => sum + (l.pnl ?? 0), 0);

    return {
      filteredLogs: filtered,
      stats: {
        totalInvested,
        totalWithdrawn,
        netAmount: totalInvested - totalWithdrawn,
        totalPnl,
        logCount: activeLogs.length,
      },
    };
  }, [logs, filterUnit, filterProduct, filterType, filterSource, showDeleted]);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleEdit = (log: DomainContributionLog) => {
    setEditingLog(log);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingLog(null);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteContributionLog(id);
      if (result.success) {
        setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, isDeleted: true } : l)));
        toast.success("已删除");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleRestore = (id: string) => {
    startTransition(async () => {
      const result = await restoreContributionLog(id);
      if (result.success) {
        setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, isDeleted: false } : l)));
        toast.success("已恢复");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    handleRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <History className="text-primary size-6" />
            时间视图
          </h1>
          <p className="text-muted-foreground text-sm">
            资金投入/取出历史记录
            {activeFilterCount > 0 && <span className="ml-2">({filteredLogs.length} 条记录)</span>}
          </p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="mr-1 size-4" />
          新增记录
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterUnit} onValueChange={setFilterUnit}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="资金单元" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部单元</SelectItem>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.unitCode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="产品" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部产品</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {OPERATION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue placeholder="来源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={showDeleted ? "secondary" : "ghost"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setShowDeleted(!showDeleted)}
        >
          {showDeleted ? "隐藏已删除" : "显示已删除"}
        </Button>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs">
            <X className="mr-1 size-3" />
            清除 ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          title="累计投入"
          value={formatCurrencyFull(stats.totalInvested)}
          icon={ArrowDownLeft}
          variant="income"
        />
        <StatCard
          title="累计取出"
          value={formatCurrencyFull(stats.totalWithdrawn)}
          icon={ArrowUpRight}
          variant="expense"
        />
        <StatCard
          title="净投入"
          value={formatCurrencyFull(stats.netAmount)}
          icon={History}
          variant="primary"
        />
        <StatCard
          title="累计收益"
          value={formatCurrencyFull(stats.totalPnl)}
          icon={TrendingUp}
          variant={stats.totalPnl >= 0 ? "income" : "expense"}
        />
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">投入记录</CardTitle>
          <CardDescription className="text-xs">按操作日期倒序排列</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={CAPITAL_TABLE_COLUMNS.date}>日期</TableHead>
                <TableHead className={CAPITAL_TABLE_COLUMNS.operationType}>类型</TableHead>
                <TableHead className={CAPITAL_TABLE_COLUMNS.amount}>金额</TableHead>
                <TableHead className={CAPITAL_TABLE_COLUMNS.pnl}>收益</TableHead>
                <TableHead className={CAPITAL_TABLE_COLUMNS.unitCode}>资金单元</TableHead>
                <TableHead className={CAPITAL_TABLE_COLUMNS.product}>产品</TableHead>
                <TableHead className={CAPITAL_TABLE_COLUMNS.source}>来源</TableHead>
                <TableHead className={CAPITAL_TABLE_COLUMNS.note}>备注</TableHead>
                <TableHead className={CAPITAL_TABLE_COLUMNS.actions}>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    暂无记录
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => {
                  const op = getOperationDisplay(log.operationType);
                  const OpIcon = op.icon;
                  return (
                    <TableRow key={log.id} className={log.isDeleted ? "opacity-50" : ""}>
                      <TableCell className="text-xs">{log.operationDate}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <OpIcon className={`size-3 ${op.color}`} />
                          <span className="text-xs">{op.label}</span>
                        </div>
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          log.amount >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {log.amount >= 0 ? "+" : ""}
                        {formatCurrencyFull(log.amount)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          log.pnl == null
                            ? "text-muted-foreground"
                            : log.pnl >= 0
                              ? "text-green-600"
                              : "text-red-600"
                        }`}
                      >
                        {log.pnl == null
                          ? "-"
                          : `${log.pnl > 0 ? "+" : ""}${formatCurrencyFull(log.pnl)}`}
                      </TableCell>
                      <TableCell>
                        {log.unit?.unitCode ? (
                          <UnitCodeBadge unitCode={log.unit.unitCode} />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.productName || log.product?.name ? (
                          <ProductBadge
                            productName={log.productName ?? log.product?.name ?? ""}
                            category={log.product?.category}
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getSourceLabel(log.source)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs">
                        {log.note ?? "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {log.isDeleted ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => handleRestore(log.id)}
                              disabled={isPending}
                            >
                              <RotateCcw className="size-3" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => handleEdit(log)}
                                disabled={isPending}
                              >
                                <Pencil className="size-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive size-7"
                                onClick={() => handleDelete(log.id)}
                                disabled={isPending}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <ContributionLogForm
        log={editingLog}
        units={units}
        products={products}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
