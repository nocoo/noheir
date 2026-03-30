"use client"

import { Layers } from "lucide-react"
import { Treemap, ResponsiveContainer, Tooltip } from "recharts"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { formatCurrencyFull } from "@/lib/chart-config"

interface TreemapItem {
  name: string
  value: number
  currency: string
  strategy: string
  [key: string]: string | number
}

interface StrategyClientProps {
  treemapData: TreemapItem[]
  totalAmount: number
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
]

export function StrategyClient({
  treemapData,
  totalAmount,
}: StrategyClientProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Layers className="text-primary size-6" />
          策略视图
        </h1>
        <p className="text-muted-foreground text-sm">
          资本配置策略分布 · 总计 {formatCurrencyFull(totalAmount)}
        </p>
      </div>

      {/* Treemap Chart */}
      <Card>
        <CardHeader>
          <CardTitle>策略配置分布</CardTitle>
          <CardDescription>
            按币种和策略的资本配置树状图
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[500px]">
            {treemapData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapData}
                  dataKey="value"
                  nameKey="name"
                  stroke="#fff"
                  fill="hsl(var(--primary))"
                  content={({ x, y, width, height, name, value, index }) => {
                    const w = Number(width ?? 0)
                    const h = Number(height ?? 0)
                    const color = COLORS[Number(index ?? 0) % COLORS.length] ?? COLORS[0] ?? "#8b5cf6"
                    return (
                      <g>
                        <rect
                          x={Number(x ?? 0)}
                          y={Number(y ?? 0)}
                          width={w}
                          height={h}
                          fill={color}
                          rx={4}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                        {w > 80 && h > 40 && (
                          <>
                            <text
                              x={Number(x ?? 0) + w / 2}
                              y={Number(y ?? 0) + h / 2 - 8}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize={12}
                              fontWeight={600}
                            >
                              {String(name ?? "")}
                            </text>
                            <text
                              x={Number(x ?? 0) + w / 2}
                              y={Number(y ?? 0) + h / 2 + 10}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize={10}
                              opacity={0.8}
                            >
                              {formatCurrencyFull(Number(value ?? 0))}
                            </text>
                          </>
                        )}
                      </g>
                    )
                  }}
                >
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]?.payload as TreemapItem | undefined
                      if (!d) return null
                      return (
                        <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                          <p className="font-medium">{d.name}</p>
                          <p className="text-muted-foreground">
                            {formatCurrencyFull(d.value)}
                            {totalAmount > 0 && ` (${((d.value / totalAmount) * 100).toFixed(1)}%)`}
                          </p>
                        </div>
                      )
                    }}
                  />
                </Treemap>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center">
                暂无策略配置数据
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Strategy Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">策略明细</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {treemapData
              .sort((a, b) => b.value - a.value)
              .map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <span className="font-medium">{item.strategy}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {item.currency}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">
                      {formatCurrencyFull(item.value)}
                    </span>
                    {totalAmount > 0 && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {((item.value / totalAmount) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
