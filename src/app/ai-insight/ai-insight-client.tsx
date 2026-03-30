"use client"

import {
  Brain,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Clock,
  Info,
  AlertCircle,
} from "lucide-react"
import type { RecurringPayment, PaymentInsight } from "@/domain/types"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { formatCurrencyFull } from "@/lib/chart-config"
import { YearSelector } from "../year-selector"

interface AIInsightClientProps {
  sortedPayments: RecurringPayment[]
  sortedInsights: PaymentInsight[]
  summary: {
    paymentsCount: number
    monthlyTotal: number
    yearlyTotal: number
    highPriorityCount: number
  }
  dataRange: {
    startDate: string
    endDate: string
    transactionCount: number
  }
  selectedYear: number | null
  availableYears: number[]
}

const frequencyLabels: Record<string, string> = {
  monthly: "每月",
  quarterly: "每季度",
  yearly: "每年",
  weekly: "每周",
  biweekly: "每两周",
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "high":
      return "bg-red-500"
    case "medium":
      return "bg-yellow-500"
    case "low":
      return "bg-green-500"
    default:
      return "bg-gray-500"
  }
}

function getInsightIcon(type: string) {
  switch (type) {
    case "recurring_payment":
      return <AlertTriangle className="size-4" />
    case "upcoming_renewal":
      return <Calendar className="size-4" />
    case "budget_alert":
      return <TrendingUp className="size-4" />
    default:
      return <Info className="size-4" />
  }
}

export function AIInsightClient({
  sortedPayments,
  sortedInsights,
  summary,
  dataRange,
  selectedYear,
  availableYears,
}: AIInsightClientProps) {
  const summaryText =
    summary.paymentsCount > 0
      ? `发现${summary.paymentsCount}个周期性付款，月度总计${formatCurrencyFull(summary.monthlyTotal)}，年度总计${formatCurrencyFull(summary.yearlyTotal)}${summary.highPriorityCount > 0 ? `，${summary.highPriorityCount}项需要立即关注` : ""}。`
      : "暂未检测到明确的周期性付款模式。"

  const isEmpty =
    sortedPayments.length === 0 && sortedInsights.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Brain className="text-primary size-6" />
            AI 财务洞察
          </h1>
          <p className="text-muted-foreground text-sm">
            基于交易数据自动分析，发现周期性支出和即将到期的付款
          </p>
        </div>
        <YearSelector
          selectedYear={selectedYear}
          availableYears={availableYears}
        />
      </div>

      {/* Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <Brain className="text-primary mt-0.5 size-5 shrink-0" />
          <p className="text-sm">{summaryText}</p>
        </CardContent>
      </Card>

      {isEmpty ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-12">
            <AlertCircle className="text-muted-foreground size-5" />
            <p className="text-muted-foreground text-sm">
              没有找到足够的交易数据来检测周期性付款模式。需要同一类别至少3笔交易记录。
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Two-column: Recurring Payments + Smart Alerts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Recurring Payments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="size-5" />
                  周期性付款 ({sortedPayments.length})
                </CardTitle>
                <CardDescription>
                  按下次付款时间排序
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4 pr-4">
                    {sortedPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="rounded-lg border p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">
                                {payment.description}
                              </h4>
                              <Badge variant="secondary">
                                {frequencyLabels[payment.frequency] ?? payment.frequency}
                              </Badge>
                            </div>
                            <div className="text-muted-foreground text-sm">
                              账户: {payment.account} | 平均:{" "}
                              {formatCurrencyFull(payment.amount)} | 共
                              {payment.occurrences}次
                            </div>
                          </div>
                          <div className="space-y-1 text-right">
                            <div className="text-sm">
                              <span className="text-muted-foreground">
                                下次付款:{" "}
                              </span>
                              <span className="font-medium">
                                {payment.nextPaymentDate}
                              </span>
                            </div>
                            <div className="text-muted-foreground text-xs">
                              平均间隔: {payment.averageInterval}天
                            </div>
                          </div>
                        </div>
                        <Separator className="my-3" />
                        <div className="space-y-1 text-sm">
                          <div>
                            年度总计:{" "}
                            {formatCurrencyFull(payment.yearlyTotal)}
                          </div>
                          <div>
                            月度估算:{" "}
                            {formatCurrencyFull(payment.yearlyTotal / 12)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Smart Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-5" />
                  智能提醒 ({sortedInsights.length})
                </CardTitle>
                <CardDescription>
                  按优先级排序
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4 pr-4">
                    {sortedInsights.length === 0 ? (
                      <div className="text-muted-foreground py-8 text-center text-sm">
                        暂无需要关注的提醒
                      </div>
                    ) : (
                      sortedInsights.map((insight, index) => (
                        <div
                          key={`${insight.type}-${index}`}
                          className="rounded-lg border p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "mt-2 size-2 shrink-0 rounded-full",
                                getPriorityColor(insight.priority),
                              )}
                            />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <h4 className="flex items-center gap-2 font-semibold">
                                  {getInsightIcon(insight.type)}
                                  {insight.title}
                                </h4>
                                <Badge
                                  variant={
                                    insight.priority === "high"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {insight.priority === "high"
                                    ? "紧急"
                                    : insight.priority === "medium"
                                      ? "提醒"
                                      : "建议"}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground text-sm">
                                {insight.description}
                              </p>
                              <p className="text-primary text-sm font-medium">
                                💡 {insight.recommendation}
                              </p>
                              {insight.dueDate && (
                                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                  <Clock className="size-4" />
                                  <span>到期时间: {insight.dueDate}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {insight.amount != null && (
                            <div className="text-right text-lg font-bold">
                              {formatCurrencyFull(insight.amount)}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Data Range */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">数据范围</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">开始日期:</span>
                  <div className="font-medium">
                    {dataRange.startDate || "—"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">结束日期:</span>
                  <div className="font-medium">
                    {dataRange.endDate || "—"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">交易记录:</span>
                  <div className="font-medium">
                    {dataRange.transactionCount}笔
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
