"use client"

import { useState } from "react"
import { Lightbulb, AlertTriangle, Clock, CheckCircle } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatCurrencyFull } from "@/lib/chart-config"
import { StatCard } from "@/components/shared/stat-card"

interface SerializedDecision {
  unitCode: string
  amount: number
  currency: string
  strategy: string
  tactics: string
  status: string
  productName: string | null
  endDate: string | null
  daysUntilMaturity?: number | undefined
  urgency: string
  reason: string
  action: string
}

interface CapitalDecisionsClientProps {
  decisions: SerializedDecision[]
  stats: {
    totalDecisions: number
    urgentCount: number
    soonCount: number
    normalCount: number
    totalAmount: number
  }
  filterCounts: Record<string, number>
}

const URGENCY_CONFIG: Record<string, { label: string; variant: "destructive" | "default" | "secondary"; icon: typeof AlertTriangle }> = {
  high: { label: "紧急", variant: "destructive", icon: AlertTriangle },
  medium: { label: "即将", variant: "default", icon: Clock },
  low: { label: "正常", variant: "secondary", icon: CheckCircle },
}

export function CapitalDecisionsClient({
  decisions,
  stats,
  filterCounts,
}: CapitalDecisionsClientProps) {
  const [filter, setFilter] = useState<string>("all")

  const filteredDecisions =
    filter === "all"
      ? decisions
      : decisions.filter((d) => d.urgency === filter)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Lightbulb className="text-primary size-6" />
          决策中心
        </h1>
        <p className="text-muted-foreground text-sm">
          需要关注和处理的资本单位
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="待处理总数"
          value={String(stats.totalDecisions)}
          icon={Lightbulb}
          variant="warning"
        />
        <StatCard
          title="紧急"
          value={String(stats.urgentCount)}
          icon={AlertTriangle}
          variant="expense"
        />
        <StatCard
          title="即将到期"
          value={String(stats.soonCount)}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="涉及金额"
          value={formatCurrencyFull(stats.totalAmount)}
          icon={Lightbulb}
          variant="income"
        />
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["all", "high", "medium", "low"].map((key) => {
          const count = key === "all" ? decisions.length : (filterCounts[key] ?? 0)
          return (
            <Badge
              key={key}
              variant={filter === key ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilter(key)}
            >
              {key === "all" ? "全部" : (URGENCY_CONFIG[key]?.label ?? key)} ({count})
            </Badge>
          )
        })}
      </div>

      {/* Decisions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">行动清单</CardTitle>
          <CardDescription>
            {filteredDecisions.length} 条待处理项
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>单位</TableHead>
                <TableHead>策略</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>到期</TableHead>
                <TableHead>紧急度</TableHead>
                <TableHead>原因</TableHead>
                <TableHead>建议操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDecisions.map((d) => {
                const config = URGENCY_CONFIG[d.urgency]
                return (
                  <TableRow key={d.unitCode}>
                    <TableCell className="font-medium">
                      {d.unitCode}
                    </TableCell>
                    <TableCell>{d.strategy}</TableCell>
                    <TableCell>
                      {formatCurrencyFull(d.amount)} {d.currency}
                    </TableCell>
                    <TableCell>
                      {d.endDate ?? "—"}
                      {d.daysUntilMaturity != null && (
                        <span
                          className={cn(
                            "ml-1 text-xs",
                            d.daysUntilMaturity <= 0
                              ? "text-destructive"
                              : d.daysUntilMaturity <= 30
                                ? "text-amber-600"
                                : "text-muted-foreground",
                          )}
                        >
                          ({d.daysUntilMaturity}天)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={config?.variant ?? "secondary"}>
                        {config?.label ?? d.urgency}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {d.reason}
                    </TableCell>
                    <TableCell className="text-primary text-sm font-medium">
                      {d.action}
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
