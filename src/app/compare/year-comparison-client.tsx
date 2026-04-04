"use client"

import { useMemo, useState } from "react"
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { GitCompare } from "lucide-react"
import type { MonthlyData } from "@/domain/types"
import {
  buildYearVsYearData,
  buildMonthVsMonthData,
} from "@/domain/dashboard/year-comparison"
import { MONTH_NAMES } from "@/lib/constants"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrencyK, formatCurrencyFull } from "@/lib/chart-config"

// ── Color constants ──

const SAVINGS_HEX = "#8b5cf6"
const SAVINGS_B_HEX = "#8b5cf699" // 60% opacity
const TARGET_HEX = "#f59e0b"

// ── Props ──

interface YearComparisonClientProps {
  yearlyMonthlyData: Record<number, MonthlyData[]>
  availableYears: number[]
  targetSavingsRate: number
}

export function YearComparisonClient({
  yearlyMonthlyData,
  availableYears,
  targetSavingsRate,
}: YearComparisonClientProps) {
  // Default to last 2 available years (descending), or same year if only 1
  const descYears = useMemo(
    () => [...availableYears].sort((a, b) => b - a),
    [availableYears],
  )
  const [yearA, setYearA] = useState<number>(descYears[1] ?? descYears[0] ?? 2024)
  const [yearB, setYearB] = useState<number>(descYears[0] ?? 2025)

  // Month comparison state
  const [monthYearA, setMonthYearA] = useState<number>(descYears[1] ?? descYears[0] ?? 2024)
  const [monthIdxA, setMonthIdxA] = useState<number>(0) // 0-indexed
  const [monthYearB, setMonthYearB] = useState<number>(descYears[0] ?? 2025)
  const [monthIdxB, setMonthIdxB] = useState<number>(0)

  // ── Year comparison data ──
  const yearCompData = useMemo(
    () =>
      buildYearVsYearData(
        yearlyMonthlyData[yearA] ?? [],
        yearlyMonthlyData[yearB] ?? [],
      ),
    [yearlyMonthlyData, yearA, yearB],
  )

  // Averages for reference lines
  const avgIncomeA = useMemo(() => {
    const months = yearlyMonthlyData[yearA] ?? []
    if (months.length === 0) return 0
    return months.reduce((s, m) => s + m.income, 0) / months.length
  }, [yearlyMonthlyData, yearA])

  const avgExpenseA = useMemo(() => {
    const months = yearlyMonthlyData[yearA] ?? []
    if (months.length === 0) return 0
    return months.reduce((s, m) => s + m.expense, 0) / months.length
  }, [yearlyMonthlyData, yearA])

  // ── Month comparison data ──
  const monthCompData = useMemo(() => {
    const dataA = yearlyMonthlyData[monthYearA]?.find(
      (m) => m.month === MONTH_NAMES[monthIdxA],
    )
    const dataB = yearlyMonthlyData[monthYearB]?.find(
      (m) => m.month === MONTH_NAMES[monthIdxB],
    )
    const labelA = `${monthYearA}-${String(monthIdxA + 1).padStart(2, "0")}`
    const labelB = `${monthYearB}-${String(monthIdxB + 1).padStart(2, "0")}`
    return buildMonthVsMonthData(labelA, dataA, labelB, dataB)
  }, [yearlyMonthlyData, monthYearA, monthIdxA, monthYearB, monthIdxB])

  if (availableYears.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">暂无数据</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Header />

      <Tabs defaultValue="year">
        <TabsList>
          <TabsTrigger value="year">年对比</TabsTrigger>
          <TabsTrigger value="month">月对比</TabsTrigger>
        </TabsList>

        {/* ── Year-vs-Year Tab ── */}
        <TabsContent value="year">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>年度收支对比</CardTitle>
                  <CardDescription>
                    选择两个年份，按月对比收支与储蓄率
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <YearSelect
                    value={yearA}
                    onChange={setYearA}
                    years={availableYears}
                    label="年份 A"
                  />
                  <span className="text-muted-foreground text-sm font-medium">vs</span>
                  <YearSelect
                    value={yearB}
                    onChange={setYearB}
                    years={availableYears}
                    label="年份 B"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={yearCompData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      tickFormatter={formatCurrencyK}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      width={50}
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      tickFormatter={(value: number) => `${value}%`}
                      domain={[-50, 100]}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                            <p className="mb-1 font-medium">{label}</p>
                            {payload.map((entry) => {
                              const key = String(entry.dataKey ?? "")
                              const val = Number(entry.value ?? 0)
                              if (key.startsWith("savingsRate")) {
                                const yr = key === "savingsRateA" ? yearA : yearB
                                return (
                                  <p key={key} style={{ color: key === "savingsRateA" ? SAVINGS_HEX : SAVINGS_B_HEX }}>
                                    {yr} 储蓄率: {val.toFixed(1)}%
                                  </p>
                                )
                              }
                              return (
                                <p key={key} style={{ color: String(entry.color ?? "") }}>
                                  {entry.name}: {formatCurrencyFull(val)}
                                </p>
                              )
                            })}
                            <p className="mt-1 border-t border-border/50 pt-1" style={{ color: TARGET_HEX }}>
                              目标储蓄率: {targetSavingsRate}%
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Legend />

                    {/* Reference lines */}
                    <ReferenceLine
                      yAxisId="left"
                      y={avgIncomeA}
                      stroke="var(--color-income)"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      label={{
                        value: `${yearA} 平均收入 ${formatCurrencyK(avgIncomeA)}`,
                        fill: "var(--color-income)",
                        fontSize: 10,
                        position: "insideTopLeft",
                      }}
                    />
                    <ReferenceLine
                      yAxisId="left"
                      y={avgExpenseA}
                      stroke="var(--color-expense)"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      label={{
                        value: `${yearA} 平均支出 ${formatCurrencyK(avgExpenseA)}`,
                        fill: "var(--color-expense)",
                        fontSize: 10,
                        position: "insideBottomLeft",
                      }}
                    />
                    <ReferenceLine
                      yAxisId="right"
                      y={targetSavingsRate}
                      stroke={TARGET_HEX}
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      label={{
                        value: `目标 ${targetSavingsRate}%`,
                        fill: TARGET_HEX,
                        fontSize: 11,
                        position: "insideTopRight",
                      }}
                    />

                    {/* Year A bars (solid) */}
                    <Bar
                      yAxisId="left"
                      dataKey="incomeA"
                      name={`${yearA} 收入`}
                      fill="var(--color-income)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="expenseA"
                      name={`${yearA} 支出`}
                      fill="var(--color-expense)"
                      radius={[4, 4, 0, 0]}
                    />
                    {/* Year B bars (lighter) */}
                    <Bar
                      yAxisId="left"
                      dataKey="incomeB"
                      name={`${yearB} 收入`}
                      fill="var(--color-income)"
                      fillOpacity={0.5}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="expenseB"
                      name={`${yearB} 支出`}
                      fill="var(--color-expense)"
                      fillOpacity={0.5}
                      radius={[4, 4, 0, 0]}
                    />

                    {/* Savings rate lines */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="savingsRateA"
                      name={`${yearA} 储蓄率`}
                      stroke={SAVINGS_HEX}
                      strokeWidth={2.5}
                      dot={{ fill: SAVINGS_HEX, r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, stroke: SAVINGS_HEX, strokeWidth: 2 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="savingsRateB"
                      name={`${yearB} 储蓄率`}
                      stroke={SAVINGS_B_HEX}
                      strokeWidth={2.5}
                      strokeDasharray="5 5"
                      dot={{ fill: SAVINGS_B_HEX, r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, stroke: SAVINGS_B_HEX, strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Month-vs-Month Tab ── */}
        <TabsContent value="month">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>月度收支对比</CardTitle>
                  <CardDescription>
                    选择两个月份，对比收支与储蓄率
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <YearSelect value={monthYearA} onChange={setMonthYearA} years={availableYears} label="年份" />
                  <MonthSelect value={monthIdxA} onChange={setMonthIdxA} label="月份" />
                  <span className="text-muted-foreground text-sm font-medium">vs</span>
                  <YearSelect value={monthYearB} onChange={setMonthYearB} years={availableYears} label="年份" />
                  <MonthSelect value={monthIdxB} onChange={setMonthIdxB} label="月份" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={monthCompData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    barCategoryGap="25%"
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 13 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      tickFormatter={formatCurrencyK}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      width={50}
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      tickFormatter={(value: number) => `${value}%`}
                      domain={[-50, 100]}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                            <p className="mb-1 font-medium">{label}</p>
                            {payload.map((entry) => {
                              const key = String(entry.dataKey ?? "")
                              const val = Number(entry.value ?? 0)
                              if (key === "savingsRate") {
                                return (
                                  <p key={key} style={{ color: SAVINGS_HEX }}>
                                    储蓄率: {val.toFixed(1)}%
                                  </p>
                                )
                              }
                              return (
                                <p key={key} style={{ color: String(entry.color ?? "") }}>
                                  {entry.name}: {formatCurrencyFull(val)}
                                </p>
                              )
                            })}
                            <p className="mt-1 border-t border-border/50 pt-1" style={{ color: TARGET_HEX }}>
                              目标储蓄率: {targetSavingsRate}%
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Legend />
                    <ReferenceLine
                      yAxisId="right"
                      y={targetSavingsRate}
                      stroke={TARGET_HEX}
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      label={{
                        value: `目标 ${targetSavingsRate}%`,
                        fill: TARGET_HEX,
                        fontSize: 11,
                        position: "insideTopRight",
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="income"
                      name="收入"
                      fill="var(--color-income)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="expense"
                      name="支出"
                      fill="var(--color-expense)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="savingsRate"
                      name="储蓄率"
                      stroke={SAVINGS_HEX}
                      strokeWidth={2.5}
                      dot={{ fill: SAVINGS_HEX, r: 5, strokeWidth: 0 }}
                      activeDot={{ r: 7, stroke: SAVINGS_HEX, strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Sub-components ──

function Header() {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <GitCompare className="text-primary size-6" />
        年度对比分析
      </h1>
      <p className="text-muted-foreground text-sm">
        多维度收支趋势与储蓄率对比
      </p>
    </div>
  )
}

function YearSelect({
  value,
  onChange,
  years,
  label,
}: {
  value: number
  onChange: (v: number) => void
  years: number[]
  label: string
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-[100px]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function MonthSelect({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (v: number) => void
  label: string
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-[90px]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {MONTH_NAMES.map((name, idx) => (
          <SelectItem key={idx} value={String(idx)}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
