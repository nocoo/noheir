"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { CreditCard } from "lucide-react"
import type { DailyBalance, DisplayEntry } from "@/domain/dashboard/account-detail"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatCurrencyFull, formatCurrencyK } from "@/lib/chart-config"
import { StatCard } from "../stat-card"

interface AccountDetailSummary {
  totalIncome: number
  totalExpense: number
  initialBalance: number
  finalBalance: number
  hasAnchor: boolean
  transactionCount: number
}

interface AccountDetailClientProps {
  uniqueAccounts: string[]
  selectedAccount: string
  dailyBalances: DailyBalance[]
  displayEntries: DisplayEntry[]
  summary: AccountDetailSummary
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  income: { label: "收入", color: "text-income" },
  expense: { label: "支出", color: "text-expense" },
  transfer: { label: "转账", color: "text-blue-600" },
  anchor: { label: "锚点", color: "text-muted-foreground" },
}

export function AccountDetailClient({
  uniqueAccounts,
  selectedAccount,
  dailyBalances,
  displayEntries,
  summary,
}: AccountDetailClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleAccountChange = (account: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("account", account)
    router.push(`/account-detail?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CreditCard className="text-primary size-6" />
            账户明细
          </h1>
          <p className="text-muted-foreground text-sm">
            查看单个账户的余额变化和交易明细
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedAccount}
            onValueChange={handleAccountChange}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="选择账户" />
            </SelectTrigger>
            <SelectContent>
              {uniqueAccounts.map((acc) => (
                <SelectItem key={acc} value={acc}>
                  {acc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="期初余额"
          value={formatCurrencyFull(summary.initialBalance)}
          icon={CreditCard}
          variant="warning"
        />
        <StatCard
          title="期末余额"
          value={formatCurrencyFull(summary.finalBalance)}
          icon={CreditCard}
          variant="warning"
        />
        <StatCard
          title="总收入"
          value={formatCurrencyFull(summary.totalIncome)}
          icon={CreditCard}
          variant="income"
        />
        <StatCard
          title="总支出"
          value={formatCurrencyFull(summary.totalExpense)}
          icon={CreditCard}
          variant="expense"
        />
      </div>

      {/* Balance Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle>余额变化</CardTitle>
          <CardDescription>
            {selectedAccount} 的日均余额趋势
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            {dailyBalances.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dailyBalances}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border/50"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    tickFormatter={formatCurrencyK}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                          <p className="mb-1 font-medium">{label}</p>
                          {payload.map((entry) => (
                            <p
                              key={String(entry.dataKey)}
                              className="text-muted-foreground"
                            >
                              {entry.name}:{" "}
                              {formatCurrencyFull(
                                Number(entry.value ?? 0),
                              )}
                            </p>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    name="余额"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center">
                暂无余额数据
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transaction Table */}
      <Card>
        <CardHeader>
          <CardTitle>交易明细</CardTitle>
          <CardDescription>
            {displayEntries.length} 条记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>类别</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead className="text-right">余额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayEntries.map((entry) => {
                const typeInfo = TYPE_LABELS[entry.type] ?? { label: "支出", color: "text-expense" }
                const isAnchor = entry.isAnchor === true

                return (
                  <TableRow
                    key={entry.id}
                    className={cn(isAnchor && "bg-muted/50")}
                  >
                    <TableCell>{entry.date}</TableCell>
                    <TableCell>
                      {isAnchor ? (
                        <Badge variant="outline">锚点</Badge>
                      ) : (
                        <span className="text-sm">
                          {entry.primaryCategory ?? "—"}
                          {entry.tertiaryCategory
                            ? ` / ${entry.tertiaryCategory}`
                            : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          entry.type === "income"
                            ? "default"
                            : entry.type === "expense"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {typeInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        typeInfo.color,
                      )}
                    >
                      {isAnchor
                        ? "—"
                        : formatCurrencyFull(entry.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyFull(entry.balanceAfter)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
