"use client"

import { useState } from "react"
import { Target, Briefcase, Coins, Lightbulb } from "lucide-react"
import type { FinancialFreedomSummary } from "@/domain/dashboard/financial-freedom"
import {
  buildReduceExpenseScenario,
  buildIncreaseIncomeScenario,
} from "@/domain/dashboard/financial-freedom"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { formatCurrencyFull } from "@/lib/chart-config"

interface CategoryItem {
  name: string
  amount: number
}

interface FinancialFreedomClientProps {
  totalIncome: number
  activeIncome: number
  passiveIncome: number
  totalExpense: number
  summary: FinancialFreedomSummary
  activeByCategoryList: CategoryItem[]
  passiveByCategoryList: CategoryItem[]
}

export function FinancialFreedomClient({
  activeIncome,
  passiveIncome,
  totalExpense,
  summary,
  activeByCategoryList,
  passiveByCategoryList,
}: FinancialFreedomClientProps) {
  const [reductionPct, setReductionPct] = useState(20)
  const [increasePct, setIncreasePct] = useState(50)

  const reduceScenario = buildReduceExpenseScenario(
    totalExpense,
    passiveIncome,
    reductionPct,
  )
  const increaseScenario = buildIncreaseIncomeScenario(
    totalExpense,
    passiveIncome,
    increasePct,
  )

  const sortedActive = [...activeByCategoryList].sort(
    (a, b) => b.amount - a.amount,
  )
  const sortedPassive = [...passiveByCategoryList].sort(
    (a, b) => b.amount - a.amount,
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Target className="text-primary size-6" />
            财务自由分析
          </h1>
          <p className="text-muted-foreground text-sm">
            被动收入 vs 支出，追踪财务自由进度
          </p>
        </div>
      </div>

      {/* Status Card */}
      <Card
        className={cn(
          "border-2",
          summary.isFree
            ? "border-emerald-500"
            : "border-amber-500",
        )}
      >
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {summary.isFree ? "已实现财务自由" : "尚未实现财务自由"}
              </h3>
              <p className="text-muted-foreground text-sm">
                被动收入覆盖支出的 {summary.freedomRatio.toFixed(1)}%
              </p>
            </div>
            <Badge
              variant={summary.isFree ? "default" : "secondary"}
              className="text-sm"
            >
              {summary.isFree
                ? `盈余 ${formatCurrencyFull(Math.abs(summary.freedomGap))}`
                : `缺口 ${formatCurrencyFull(summary.freedomGap)}`}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>被动收入: {formatCurrencyFull(passiveIncome)}</span>
              <span>总支出: {formatCurrencyFull(totalExpense)}</span>
            </div>
            <Progress
              value={Math.min(summary.freedomRatio, 100)}
              className="h-3"
            />
          </div>
        </CardContent>
      </Card>

      {/* Income Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="size-5" />
              主动收入 ({formatCurrencyFull(activeIncome)})
            </CardTitle>
            <CardDescription>工资、劳务等需要投入时间的收入</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedActive.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                暂无主动收入分类配置
              </p>
            ) : (
              <div className="space-y-3">
                {sortedActive.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{item.name}</span>
                    <span className="font-medium">
                      {formatCurrencyFull(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="size-5" />
              被动收入 ({formatCurrencyFull(passiveIncome)})
            </CardTitle>
            <CardDescription>
              投资理财、股息、租金等不需要主动工作的收入
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sortedPassive.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                暂无被动收入记录
              </p>
            ) : (
              <div className="space-y-3">
                {sortedPassive.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{item.name}</span>
                    <span className="font-medium">
                      {formatCurrencyFull(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* What-If Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="size-5" />
            假设场景分析
          </CardTitle>
          <CardDescription>
            调整滑块探索不同情境下的财务自由可能性
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="reduce" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="reduce">削减支出</TabsTrigger>
              <TabsTrigger value="increase">增加被动收入</TabsTrigger>
            </TabsList>

            <TabsContent value="reduce" className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>削减支出比例</span>
                  <span className="font-medium">{reductionPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={80}
                  step={5}
                  value={reductionPct}
                  onChange={(e) =>
                    setReductionPct(Number(e.target.value))
                  }
                  className="w-full"
                />
              </div>
              <div className="bg-muted/50 space-y-2 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span>调整后支出:</span>
                  <span className="font-medium">
                    {formatCurrencyFull(reduceScenario.currentValue)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>被动收入:</span>
                  <span className="font-medium">
                    {formatCurrencyFull(passiveIncome)}
                  </span>
                </div>
                <Progress
                  value={Math.min(reduceScenario.percentage, 100)}
                  className="h-3"
                />
                <Badge
                  variant={
                    reduceScenario.isAchieved ? "default" : "destructive"
                  }
                >
                  {reduceScenario.isAchieved
                    ? "可实现财务自由"
                    : `还差 ${formatCurrencyFull(Math.abs(reduceScenario.gap))}`}
                </Badge>
              </div>
            </TabsContent>

            <TabsContent value="increase" className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>增加被动收入比例</span>
                  <span className="font-medium">{increasePct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={500}
                  step={10}
                  value={increasePct}
                  onChange={(e) =>
                    setIncreasePct(Number(e.target.value))
                  }
                  className="w-full"
                />
              </div>
              <div className="bg-muted/50 space-y-2 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span>总支出:</span>
                  <span className="font-medium">
                    {formatCurrencyFull(totalExpense)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>预计被动收入:</span>
                  <span className="font-medium">
                    {formatCurrencyFull(increaseScenario.targetValue)}
                  </span>
                </div>
                <Progress
                  value={Math.min(increaseScenario.percentage, 100)}
                  className="h-3"
                />
                <Badge
                  variant={
                    increaseScenario.isAchieved
                      ? "default"
                      : "destructive"
                  }
                >
                  {increaseScenario.isAchieved
                    ? "可实现财务自由"
                    : `还差 ${formatCurrencyFull(Math.abs(increaseScenario.gap))}`}
                </Badge>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">财务自由小贴士</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm">
            <li>财务自由的核心：被动收入 ≥ 生活支出</li>
            <li>先积累本金，再追求被动收入的增长</li>
            <li>控制支出增长比提高收入更容易实现</li>
            <li>多元化被动收入来源，降低单一风险</li>
            <li>定期审视主动收入分类配置，确保分析准确</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
