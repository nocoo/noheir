import { LayerCard } from "@nocoo/basalt";
import { Badge } from "@nocoo/basalt/components/badge";
import { overlayPanelClass } from "@nocoo/basalt/components/overlay";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nocoo/basalt/components/table";
import { CreditCard, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "@/components/shared/stat-card";
import type { AccountType } from "@/domain/types";
import { formatCurrencyFull, formatCurrencyK } from "@/lib/chart-config";
import { cn } from "@/lib/utils";

interface SerializedAccount {
  name: string;
  income: number;
  expense: number;
  balance: number;
  transactionCount: number;
}

interface SerializedAccountGroup {
  prefix: string;
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  totalTransactions: number;
  accountType?: AccountType | undefined;
  accounts: SerializedAccount[];
}

interface AccountAnalysisClientProps {
  accounts: SerializedAccount[];
  accountGroups: SerializedAccountGroup[];
  chartData: Array<{
    name: string;
    income: number;
    expense: number;
    balance: number;
  }>;
  pieData: Array<{ name: string; value: number; percentage: number }>;
  summaryStats: {
    accountCount: number;
    totalTransactions: number;
    totalFlow: number;
    totalIncome: number;
    totalExpense: number;
  };
}

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#64748b",
];

const INCOME_HEX = "var(--color-income)";
const EXPENSE_HEX = "var(--color-expense)";
const BALANCE_HEX = "hsl(var(--chart-1))";

export function AccountAnalysisClient({
  accounts,
  accountGroups,
  chartData,
  pieData,
  summaryStats,
}: AccountAnalysisClientProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Wallet className="text-basalt-primary size-6" />
            账户分析
          </h1>
          <p className="text-basalt-muted-foreground text-sm">各账户收支概览与分布</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="账户数量"
          value={String(summaryStats.accountCount)}
          icon={CreditCard}
          variant="income"
        />
        <StatCard
          title="总流水"
          value={formatCurrencyFull(summaryStats.totalFlow)}
          icon={Wallet}
          variant="warning"
        />
        <StatCard
          title="净流入"
          value={formatCurrencyFull(summaryStats.totalIncome)}
          icon={TrendingUp}
          variant="income"
        />
        <StatCard
          title="净流出"
          value={formatCurrencyFull(summaryStats.totalExpense)}
          icon={TrendingDown}
          variant="expense"
        />
      </div>

      {/* Bar Chart */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="text-lg font-semibold leading-none tracking-tight text-basalt-foreground">
            账户收支对比
          </h3>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1">
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData.slice(0, 15)}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-basalt-border/50" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  className="text-basalt-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-basalt-muted-foreground"
                  tickFormatter={formatCurrencyK}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div
                        className={overlayPanelClass(
                          "px-basalt-card-sm py-basalt-space-lg text-basalt-sm",
                        )}
                      >
                        <p className="mb-1 font-medium">{label}</p>
                        {payload.map((entry) => (
                          <p
                            key={String(entry.dataKey)}
                            style={{ color: String(entry.color ?? "") }}
                          >
                            {entry.name}: {formatCurrencyFull(Number(entry.value ?? 0))}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar dataKey="income" name="收入" fill={INCOME_HEX} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="支出" fill={EXPENSE_HEX} radius={[4, 4, 0, 0]} />
                <Bar dataKey="balance" name="结余" fill={BALANCE_HEX} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </LayerCard.Body>
      </LayerCard>

      {/* Pie + Groups */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pie Chart */}
        <LayerCard>
          <LayerCard.Header className="items-stretch flex-col gap-1.5">
            <h3 className="text-lg font-semibold leading-none tracking-tight text-basalt-foreground">
              交易量分布
            </h3>
            <p className="text-sm text-basalt-muted-foreground">各账户交易金额占比</p>
          </LayerCard.Header>
          <LayerCard.Body className="min-h-0 flex-1">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={50}
                    paddingAngle={2}
                    label={({ name, percent }: { name?: string | number; percent?: number }) =>
                      `${String(name ?? "")} ${((percent ?? 0) * 100).toFixed(1)}%`
                    }
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        // biome-ignore lint/suspicious/noArrayIndexKey: recharts Cell binds to data position
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length] ?? PIE_COLORS[0] ?? "#64748b"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0]?.payload as
                        | {
                            name: string;
                            value: number;
                            percentage: number;
                          }
                        | undefined;
                      if (!data) return null;
                      return (
                        <div
                          className={overlayPanelClass(
                            "px-basalt-card-sm py-basalt-space-lg text-basalt-sm",
                          )}
                        >
                          <p className="font-medium">{data.name}</p>
                          <p className="text-basalt-muted-foreground">
                            {formatCurrencyFull(data.value)} ({data.percentage.toFixed(1)}%)
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </LayerCard.Body>
        </LayerCard>

        {/* Account Groups */}
        <LayerCard>
          <LayerCard.Header className="items-stretch flex-col gap-1.5">
            <h3 className="text-lg font-semibold leading-none tracking-tight text-basalt-foreground">
              账户分组
            </h3>
            <p className="text-sm text-basalt-muted-foreground">按前缀分组的账户概览</p>
          </LayerCard.Header>
          <LayerCard.Body className="min-h-0 flex-1 space-y-4">
            {accountGroups.map((group) => (
              <div key={group.prefix} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{group.prefix}</h4>
                    <Badge variant="secondary">{group.accounts.length} 账户</Badge>
                  </div>
                  <span
                    className={cn(
                      "font-medium",
                      group.totalBalance >= 0 ? "text-income" : "text-expense",
                    )}
                  >
                    {formatCurrencyFull(group.totalBalance)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.accounts.slice(0, 6).map((acc) => (
                    <div key={acc.name} className="rounded-md border p-2 text-xs">
                      <p className="truncate font-medium">{acc.name}</p>
                      <p className="text-basalt-muted-foreground">{acc.transactionCount}笔</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </LayerCard.Body>
        </LayerCard>
      </div>

      {/* Account Table */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="text-lg font-semibold leading-none tracking-tight text-basalt-foreground">
            账户明细表
          </h3>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1">
          <div className="relative w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>账户</TableHead>
                  <TableHead className="text-right">收入</TableHead>
                  <TableHead className="text-right">支出</TableHead>
                  <TableHead className="text-right">结余</TableHead>
                  <TableHead className="text-right">笔数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((acc) => (
                  <TableRow key={acc.name}>
                    <TableCell className="font-medium">{acc.name}</TableCell>
                    <TableCell className="text-income text-right">
                      {formatCurrencyFull(acc.income)}
                    </TableCell>
                    <TableCell className="text-expense text-right">
                      {formatCurrencyFull(acc.expense)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        acc.balance >= 0 ? "text-income" : "text-expense",
                      )}
                    >
                      {formatCurrencyFull(acc.balance)}
                    </TableCell>
                    <TableCell className="text-right">{acc.transactionCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </LayerCard.Body>
      </LayerCard>
    </div>
  );
}
