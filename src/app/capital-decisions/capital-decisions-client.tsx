"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle,
  Clock,
  Lightbulb,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyBadge, StrategyBadge, UnitCodeBadge } from "@/components/ui/colored-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyFull } from "@/lib/chart-config";
import { CAPITAL_TABLE_COLUMNS } from "@/lib/table-columns";
import { cn } from "@/lib/utils";

interface SerializedDecision {
  unitCode: string;
  amount: number;
  currency: string;
  strategy: string;
  tactics: string;
  status: string;
  productName: string | null;
  availableDate: string | null;
  daysUntilAvailable?: number | null;
  urgency: string;
  reason: string;
  action: string;
}

interface CapitalDecisionsClientProps {
  decisions: SerializedDecision[];
  stats: {
    totalDecisions: number;
    urgentCount: number;
    soonCount: number;
    normalCount: number;
    totalAmount: number;
    urgentAmount: number;
    soonAmount: number;
    normalAmount: number;
  };
  filterCounts: Record<string, number>;
}

type SortColumn = "unitCode" | "strategy" | "urgency" | "amount";
type SortDirection = "asc" | "desc";

const URGENCY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const URGENCY_CONFIG: Record<
  string,
  { label: string; variant: "destructive" | "default" | "secondary"; icon: typeof AlertTriangle }
> = {
  high: { label: "紧急", variant: "destructive", icon: AlertTriangle },
  medium: { label: "即将", variant: "default", icon: Clock },
  low: { label: "正常", variant: "secondary", icon: CheckCircle },
};

export function CapitalDecisionsClient({
  decisions,
  stats,
  filterCounts,
}: CapitalDecisionsClientProps) {
  const [filter, setFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("urgency");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-1 inline size-4" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline size-4" />
    ) : (
      <ArrowDown className="ml-1 inline size-4" />
    );
  };

  const getAriaSort = (column: SortColumn): "ascending" | "descending" | "none" => {
    if (sortColumn !== column) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  };

  const filteredAndSortedDecisions = useMemo(() => {
    const result =
      filter === "all" ? [...decisions] : decisions.filter((d) => d.urgency === filter);

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "unitCode":
          cmp = a.unitCode.localeCompare(b.unitCode);
          break;
        case "strategy":
          cmp = a.strategy.localeCompare(b.strategy);
          break;
        case "urgency":
          cmp = (URGENCY_ORDER[a.urgency] ?? 99) - (URGENCY_ORDER[b.urgency] ?? 99);
          break;
        case "amount":
          cmp = a.amount - b.amount;
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [decisions, filter, sortColumn, sortDirection]);

  // Empty state
  if (decisions.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Lightbulb className="text-primary size-6" />
            决策中心
          </h1>
          <p className="text-muted-foreground text-sm">需要关注和处理的资本单位</p>
        </div>
        <div className="rounded-xl border p-12 text-center">
          <div className="mb-4 text-4xl">✅</div>
          <h3 className="mb-2 text-lg font-semibold">一切正常</h3>
          <p className="text-muted-foreground">当前没有需要特别关注的资金项目</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Lightbulb className="text-primary size-6" />
          决策中心
        </h1>
        <p className="text-muted-foreground text-sm">需要关注和处理的资本单位</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">需决策项目</p>
          <p className="text-2xl font-bold">{stats.totalDecisions}</p>
          <p className="text-muted-foreground text-xs">
            涉及 {formatCurrencyFull(stats.totalAmount)}
          </p>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-destructive text-sm">紧急</p>
          <p className="text-destructive text-2xl font-bold">{stats.urgentCount}</p>
          <p className="text-muted-foreground text-xs">{formatCurrencyFull(stats.urgentAmount)}</p>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-600 dark:text-amber-400">即将到期</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.soonCount}</p>
          <p className="text-muted-foreground text-xs">{formatCurrencyFull(stats.soonAmount)}</p>
        </div>
        <div className="rounded-lg border border-slate-500/30 bg-slate-500/5 p-4">
          <p className="text-muted-foreground text-sm">正常</p>
          <p className="text-2xl font-bold">{stats.normalCount}</p>
          <p className="text-muted-foreground text-xs">{formatCurrencyFull(stats.normalAmount)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {["all", "high", "medium", "low"].map((key) => {
          const count = key === "all" ? decisions.length : (filterCounts[key] ?? 0);
          return (
            <Button
              key={key}
              variant={filter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(key)}
              className="gap-2"
            >
              {key === "all" ? "全部" : (URGENCY_CONFIG[key]?.label ?? key)}
              <Badge variant={filter === key ? "secondary" : "outline"} className="text-xs">
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Decisions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">行动清单</CardTitle>
          <CardDescription>{filteredAndSortedDecisions.length} 条待处理项</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className={CAPITAL_TABLE_COLUMNS.urgency}
                  aria-sort={getAriaSort("urgency")}
                >
                  <button
                    type="button"
                    onClick={() => handleSort("urgency")}
                    className="hover:text-foreground flex items-center text-sm transition-colors"
                  >
                    紧急度
                    {getSortIcon("urgency")}
                  </button>
                </TableHead>
                <TableHead
                  className={CAPITAL_TABLE_COLUMNS.unitCode}
                  aria-sort={getAriaSort("unitCode")}
                >
                  <button
                    type="button"
                    onClick={() => handleSort("unitCode")}
                    className="hover:text-foreground flex items-center text-sm transition-colors"
                  >
                    单位
                    {getSortIcon("unitCode")}
                  </button>
                </TableHead>
                <TableHead
                  className={CAPITAL_TABLE_COLUMNS.strategy}
                  aria-sort={getAriaSort("strategy")}
                >
                  <button
                    type="button"
                    onClick={() => handleSort("strategy")}
                    className="hover:text-foreground flex items-center text-sm transition-colors"
                  >
                    策略
                    {getSortIcon("strategy")}
                  </button>
                </TableHead>
                <TableHead
                  className={CAPITAL_TABLE_COLUMNS.amount}
                  aria-sort={getAriaSort("amount")}
                >
                  <button
                    type="button"
                    onClick={() => handleSort("amount")}
                    className="hover:text-foreground flex items-center text-sm transition-colors"
                  >
                    金额
                    {getSortIcon("amount")}
                  </button>
                </TableHead>
                <TableHead className={CAPITAL_TABLE_COLUMNS.date}>到期</TableHead>
                <TableHead className={CAPITAL_TABLE_COLUMNS.reason}>原因</TableHead>
                <TableHead className={CAPITAL_TABLE_COLUMNS.reason}>建议操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedDecisions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                    该筛选条件下没有项目
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedDecisions.map((d) => {
                  const config = URGENCY_CONFIG[d.urgency];
                  return (
                    <TableRow key={d.unitCode}>
                      <TableCell>
                        <Badge variant={config?.variant ?? "secondary"}>
                          {config?.label ?? d.urgency}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <UnitCodeBadge unitCode={d.unitCode} />
                      </TableCell>
                      <TableCell>
                        <StrategyBadge strategy={d.strategy} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrencyFull(d.amount)}{" "}
                        <CurrencyBadge currency={d.currency} className="ml-1 text-xs" />
                      </TableCell>
                      <TableCell>
                        {d.availableDate ?? "—"}
                        {d.daysUntilAvailable != null && (
                          <span
                            className={cn(
                              "ml-1 text-xs",
                              d.daysUntilAvailable <= 0
                                ? "text-green-600 dark:text-green-400"
                                : d.daysUntilAvailable <= 30
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-destructive",
                            )}
                          >
                            (
                            {d.daysUntilAvailable <= 0
                              ? "可用"
                              : d.daysUntilAvailable <= 30
                                ? `${d.daysUntilAvailable}天`
                                : "锁定中"}
                            )
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{d.reason}</TableCell>
                      <TableCell className="text-primary text-sm font-medium">{d.action}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
