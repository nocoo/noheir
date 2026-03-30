"use client"

import { useState } from "react"
import { Warehouse, Search } from "lucide-react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatCurrencyFull } from "@/lib/chart-config"

interface SerializedUnit {
  id: string
  unitCode: string
  amount: number
  currency: string
  status: string
  strategy: string
  tactics: string
  productName: string | null
  startDate: string | null
  endDate: string | null
  daysUntilMaturity?: number | undefined
  isAvailable?: boolean | undefined
}

interface WarehouseClientProps {
  units: SerializedUnit[]
}

const STATUS_COLORS: Record<string, string> = {
  已成立: "bg-emerald-500",
  计划中: "bg-blue-500",
  筹集中: "bg-amber-500",
  已归档: "bg-gray-400",
}

export function WarehouseClient({ units }: WarehouseClientProps) {
  const [search, setSearch] = useState("")

  const filtered = search
    ? units.filter(
        (u) =>
          u.unitCode.toLowerCase().includes(search.toLowerCase()) ||
          u.strategy.includes(search) ||
          u.tactics.includes(search) ||
          (u.productName ?? "").includes(search),
      )
    : units

  const totalAmount = filtered.reduce((sum, u) => sum + u.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Warehouse className="text-primary size-6" />
            资本仓库
          </h1>
          <p className="text-muted-foreground text-sm">
            所有资本单位一览 · {filtered.length}个 ·{" "}
            {formatCurrencyFull(totalAmount)}
          </p>
        </div>
        <div className="relative">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="搜索单位..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[200px] pl-9"
          />
        </div>
      </div>

      {/* Waffle Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((unit) => {
          const statusColor = STATUS_COLORS[unit.status] ?? "bg-gray-400"
          return (
            <Card
              key={unit.id}
              className="relative overflow-hidden"
            >
              <div className={cn("absolute left-0 top-0 h-full w-1", statusColor)} />
              <CardContent className="space-y-1 p-3 pl-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">
                    {unit.unitCode}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {unit.status}
                  </Badge>
                </div>
                <p className="text-primary text-sm font-bold">
                  {formatCurrencyFull(unit.amount)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {unit.strategy} · {unit.tactics}
                </p>
                {unit.productName && (
                  <p className="text-muted-foreground truncate text-xs">
                    {unit.productName}
                  </p>
                )}
                {unit.endDate && (
                  <p
                    className={cn(
                      "text-xs",
                      unit.daysUntilMaturity != null && unit.daysUntilMaturity <= 0
                        ? "text-destructive font-medium"
                        : unit.daysUntilMaturity != null && unit.daysUntilMaturity <= 30
                          ? "text-amber-600"
                          : "text-muted-foreground",
                    )}
                  >
                    到期: {unit.endDate}
                    {unit.daysUntilMaturity != null && ` (${unit.daysUntilMaturity}天)`}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-muted-foreground py-12 text-center">
          {search ? "未找到匹配的单位" : "暂无资本单位"}
        </div>
      )}
    </div>
  )
}
