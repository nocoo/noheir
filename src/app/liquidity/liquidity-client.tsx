import { Button, LayerCard } from "@nocoo/basalt";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@nocoo/basalt/components/collapsible";
import { overlayPanelClass } from "@nocoo/basalt/components/overlay";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nocoo/basalt/components/table";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Droplets,
  ExternalLink,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "@/components/shared/stat-card";
import {
  ProductBadge,
  StrategyBadge,
  TacticsBadge,
  UnitCodeBadge,
} from "@/components/ui/colored-badge";
import type { UpcomingUnit } from "@/domain/assets/liquidity-ladder";
import { formatCurrencyFull, formatCurrencyK, yAxisWidth } from "@/lib/chart-config";
import { CAPITAL_TABLE_COLUMNS } from "@/lib/table-columns";
import { cn } from "@/lib/utils";

interface LiquidityClientProps {
  chartData: Record<string, string | number>[];
  strategies: string[];
  total12m: number;
  avgMonth: number;
  peakMonth: string;
  peakAmount: number;
  upcomingUnits: UpcomingUnit[];
}

const COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

export function LiquidityClient({
  chartData,
  strategies,
  total12m,
  avgMonth,
  peakMonth,
  peakAmount,
  upcomingUnits,
}: LiquidityClientProps) {
  // Track collapsed state for each month
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const toggleMonth = (monthKey: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  };

  // Group units by month
  const unitsByMonth = upcomingUnits.reduce(
    (acc, unit) => {
      const key = unit.monthKey;
      if (!acc[key]) {
        acc[key] = { monthLabel: unit.monthLabel, units: [] };
      }
      acc[key].units.push(unit);
      return acc;
    },
    {} as Record<string, { monthLabel: string; units: UpcomingUnit[] }>,
  );

  // Sort months chronologically
  const sortedMonths = Object.keys(unitsByMonth).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Droplets className="text-basalt-primary size-6" />
          流动性阶梯
        </h1>
        <p className="text-basalt-muted-foreground text-sm">未来24个月到期资金分布</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="12个月到期总额"
          value={formatCurrencyFull(total12m)}
          icon={TrendingUp}
          variant="income"
        />
        <StatCard
          title="月均到期"
          value={formatCurrencyFull(avgMonth)}
          icon={Calendar}
          variant="warning"
        />
        <StatCard title="峰值月份" value={peakMonth || "—"} icon={BarChart3} variant="warning" />
        <StatCard
          title="峰值金额"
          value={formatCurrencyFull(peakAmount)}
          icon={Droplets}
          variant="expense"
        />
      </div>

      {/* Stacked Bar Chart */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="text-lg font-semibold leading-none tracking-tight text-basalt-foreground">
            到期时间分布
          </h3>
          <p className="text-sm text-basalt-muted-foreground">按策略分组的月度到期金额堆叠图</p>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1">
          <div className="h-[400px]">
            {chartData.length > 0 && strategies.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={10} angle={-45} textAnchor="end" height={80} />
                  <YAxis width={yAxisWidth} tickFormatter={formatCurrencyK} fontSize={11} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div
                          className={overlayPanelClass(
                            "px-basalt-card-sm py-basalt-space-lg text-basalt-sm",
                          )}
                        >
                          <p className="mb-1 font-medium">{String(label ?? "")}</p>
                          {payload.map((entry) => (
                            <p
                              key={String(entry.name ?? "")}
                              className="text-basalt-muted-foreground"
                            >
                              <span
                                className="mr-1 inline-block size-2 rounded-full"
                                style={{ backgroundColor: String(entry.color ?? "#888") }}
                              />
                              {String(entry.name ?? "")}:{" "}
                              {formatCurrencyFull(Number(entry.value ?? 0))}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  {strategies.map((strategy, i) => (
                    <Bar
                      key={strategy}
                      dataKey={strategy}
                      stackId="total"
                      fill={COLORS[i % COLORS.length] ?? COLORS[0] ?? "#8b5cf6"}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-basalt-muted-foreground flex h-full items-center justify-center">
                暂无到期数据
              </div>
            )}
          </div>
        </LayerCard.Body>
      </LayerCard>

      {/* Upcoming Units Table - Grouped by Month */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold leading-none tracking-tight text-basalt-foreground">
                即将解禁明细
              </h3>
              <p className="text-sm text-basalt-muted-foreground">
                未来24个月内到期的资金单元，共 {upcomingUnits.length} 个
              </p>
            </div>
            <Link
              to="/warehouse?availability=soon"
              className="text-basalt-primary hover:text-basalt-primary/80 flex items-center gap-1 text-sm"
            >
              <Warehouse className="size-4" />
              在仓库查看
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1">
          {sortedMonths.length > 0 ? (
            <div className="space-y-4">
              {sortedMonths.map((monthKey) => {
                const monthData = unitsByMonth[monthKey];
                if (!monthData) return null;
                const monthTotal = monthData.units.reduce((sum, u) => sum + u.amount, 0);
                const isCollapsed = collapsedMonths.has(monthKey);

                return (
                  <Collapsible
                    key={monthKey}
                    open={!isCollapsed}
                    onOpenChange={() => toggleMonth(monthKey)}
                  >
                    {/* Month Header - Clickable */}
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between">
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={cn(
                              "size-4 transition-transform",
                              isCollapsed && "-rotate-90",
                            )}
                          />
                          <h3 className="font-semibold">{monthData.monthLabel}</h3>
                        </div>
                        <span className="text-basalt-muted-foreground text-sm">
                          {monthData.units.length} 个单元 · {formatCurrencyFull(monthTotal)}
                        </span>
                      </Button>
                    </CollapsibleTrigger>

                    {/* Units Table */}
                    <CollapsibleContent unstyled>
                      <div className="relative w-full overflow-x-auto">
                        <Table className="mt-2">
                          <TableHeader>
                            <TableRow>
                              <TableHead className={CAPITAL_TABLE_COLUMNS.unitCode}>编号</TableHead>
                              <TableHead className={CAPITAL_TABLE_COLUMNS.strategy}>策略</TableHead>
                              <TableHead className={CAPITAL_TABLE_COLUMNS.tactics}>战术</TableHead>
                              <TableHead className={CAPITAL_TABLE_COLUMNS.product}>产品</TableHead>
                              <TableHead className={CAPITAL_TABLE_COLUMNS.amount}>金额</TableHead>
                              <TableHead className={CAPITAL_TABLE_COLUMNS.date}>解禁日</TableHead>
                              <TableHead className={CAPITAL_TABLE_COLUMNS.countdown}>
                                倒计时
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthData.units.map((unit) => (
                              <TableRow key={unit.id}>
                                <TableCell>
                                  <Link to={`/warehouse?q=${unit.unitCode}`}>
                                    <UnitCodeBadge unitCode={unit.unitCode} />
                                  </Link>
                                </TableCell>
                                <TableCell>
                                  <StrategyBadge strategy={unit.strategy} />
                                </TableCell>
                                <TableCell>
                                  <TacticsBadge tactics={unit.tactics} />
                                </TableCell>
                                <TableCell>
                                  {unit.productName ? (
                                    <Link
                                      to={`/products?q=${encodeURIComponent(unit.productName)}`}
                                    >
                                      <ProductBadge
                                        productName={unit.productName}
                                        category={unit.productCategory}
                                      />
                                    </Link>
                                  ) : (
                                    <span className="text-basalt-muted-foreground text-sm">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrencyFull(unit.amount)}
                                </TableCell>
                                <TableCell className="text-basalt-muted-foreground text-right text-sm">
                                  {unit.availableDate}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      unit.daysUntilAvailable <= 0
                                        ? "text-green-600 dark:text-green-400"
                                        : unit.daysUntilAvailable <= 30
                                          ? "text-amber-600 dark:text-amber-400"
                                          : "text-basalt-muted-foreground",
                                    )}
                                  >
                                    {unit.daysUntilAvailable <= 0
                                      ? "已可用"
                                      : `${unit.daysUntilAvailable}天`}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          ) : (
            <div className="text-basalt-muted-foreground py-8 text-center">
              暂无即将解禁的资金单元
            </div>
          )}
        </LayerCard.Body>
      </LayerCard>
    </div>
  );
}
