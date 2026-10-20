import { LayerCard } from "@nocoo/basalt";
import { Badge } from "@nocoo/basalt/components/badge";
import { Slider } from "@nocoo/basalt/components/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nocoo/basalt/components/tabs";
import { Briefcase, Coins, Lightbulb, Target } from "lucide-react";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import type { FinancialFreedomSummary } from "@/domain/dashboard/financial-freedom";
import {
  buildIncreaseIncomeScenario,
  buildReduceExpenseScenario,
} from "@/domain/dashboard/financial-freedom";
import { formatCurrencyFull } from "@/lib/chart-config";
import { cn } from "@/lib/utils";

interface CategoryItem {
  name: string;
  amount: number;
}

interface FinancialFreedomClientProps {
  totalIncome: number;
  activeIncome: number;
  passiveIncome: number;
  totalExpense: number;
  summary: FinancialFreedomSummary;
  activeByCategoryList: CategoryItem[];
  passiveByCategoryList: CategoryItem[];
}

export function FinancialFreedomClient({
  activeIncome,
  passiveIncome,
  totalExpense,
  summary,
  activeByCategoryList,
  passiveByCategoryList,
}: FinancialFreedomClientProps) {
  const [reductionPct, setReductionPct] = useState(20);
  const [increasePct, setIncreasePct] = useState(50);

  const reduceScenario = buildReduceExpenseScenario(totalExpense, passiveIncome, reductionPct);
  const increaseScenario = buildIncreaseIncomeScenario(totalExpense, passiveIncome, increasePct);

  const sortedActive = [...activeByCategoryList].sort((a, b) => b.amount - a.amount);
  const sortedPassive = [...passiveByCategoryList].sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Target className="text-basalt-primary size-6" />
            财务自由分析
          </h1>
          <p className="text-basalt-muted-foreground text-sm">被动收入 vs 支出，追踪财务自由进度</p>
        </div>
      </div>

      {/* Status Card */}
      <LayerCard
        className={cn(
          "border-l-4",
          summary.isFree ? "border-l-basalt-success" : "border-l-amber-500",
        )}
      >
        <LayerCard.Body className="min-h-0 flex-1 space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {summary.isFree ? "已实现财务自由" : "尚未实现财务自由"}
              </h3>
              <p className="text-basalt-muted-foreground text-sm">
                被动收入覆盖支出的 {summary.freedomRatio.toFixed(1)}%
              </p>
            </div>
            <Badge variant={summary.isFree ? "default" : "secondary"} className="text-sm">
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
            <Progress value={Math.min(summary.freedomRatio, 100)} className="h-3" />
          </div>
        </LayerCard.Body>
      </LayerCard>

      {/* Income Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LayerCard className="border-l-4 border-l-basalt-primary">
          <LayerCard.Header className="items-stretch flex-col gap-1.5">
            <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground flex items-center gap-2 text-base">
              <Briefcase className="text-basalt-primary size-5" />
              主动收入 ({formatCurrencyFull(activeIncome)})
            </h3>
            <p className="text-sm text-basalt-muted-foreground">工资、劳务等需要投入时间的收入</p>
          </LayerCard.Header>
          <LayerCard.Body className="min-h-0 flex-1">
            {sortedActive.length === 0 ? (
              <p className="text-basalt-muted-foreground text-sm">暂无主动收入分类配置</p>
            ) : (
              <div className="space-y-3">
                {sortedActive.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <span className="text-sm">{item.name}</span>
                    <span className="font-medium">{formatCurrencyFull(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </LayerCard.Body>
        </LayerCard>

        <LayerCard className="border-l-4 border-l-basalt-success">
          <LayerCard.Header className="items-stretch flex-col gap-1.5">
            <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground flex items-center gap-2 text-base">
              <Coins className="text-basalt-success size-5" />
              被动收入 ({formatCurrencyFull(passiveIncome)})
            </h3>
            <p className="text-sm text-basalt-muted-foreground">
              投资理财、股息、租金等不需要主动工作的收入
            </p>
          </LayerCard.Header>
          <LayerCard.Body className="min-h-0 flex-1">
            {sortedPassive.length === 0 ? (
              <p className="text-basalt-muted-foreground text-sm">暂无被动收入记录</p>
            ) : (
              <div className="space-y-3">
                {sortedPassive.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <span className="text-sm">{item.name}</span>
                    <span className="font-medium">{formatCurrencyFull(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </LayerCard.Body>
        </LayerCard>
      </div>

      {/* What-If Scenarios */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground flex items-center gap-2 text-base">
            <Lightbulb className="size-5" />
            假设场景分析
          </h3>
          <p className="text-sm text-basalt-muted-foreground">
            调整滑块探索不同情境下的财务自由可能性
          </p>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1">
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
                <Slider
                  aria-label="削减支出比例"
                  min={0}
                  max={80}
                  step={5}
                  value={[reductionPct]}
                  onValueChange={([value]) => setReductionPct(value ?? 0)}
                />
              </div>
              <div className="space-y-2 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span>调整后支出:</span>
                  <span className="font-medium">
                    {formatCurrencyFull(reduceScenario.currentValue)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>被动收入:</span>
                  <span className="font-medium">{formatCurrencyFull(passiveIncome)}</span>
                </div>
                <Progress value={Math.min(reduceScenario.percentage, 100)} className="h-3" />
                <Badge variant={reduceScenario.isAchieved ? "default" : "destructive"}>
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
                <Slider
                  aria-label="增加被动收入比例"
                  min={0}
                  max={500}
                  step={10}
                  value={[increasePct]}
                  onValueChange={([value]) => setIncreasePct(value ?? 0)}
                />
              </div>
              <div className="space-y-2 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span>总支出:</span>
                  <span className="font-medium">{formatCurrencyFull(totalExpense)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>预计被动收入:</span>
                  <span className="font-medium">
                    {formatCurrencyFull(increaseScenario.targetValue)}
                  </span>
                </div>
                <Progress value={Math.min(increaseScenario.percentage, 100)} className="h-3" />
                <Badge variant={increaseScenario.isAchieved ? "default" : "destructive"}>
                  {increaseScenario.isAchieved
                    ? "可实现财务自由"
                    : `还差 ${formatCurrencyFull(Math.abs(increaseScenario.gap))}`}
                </Badge>
              </div>
            </TabsContent>
          </Tabs>
        </LayerCard.Body>
      </LayerCard>

      {/* Tips */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground text-base">
            财务自由小贴士
          </h3>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1">
          <ul className="text-basalt-muted-foreground list-disc space-y-2 pl-5 text-sm">
            <li>财务自由的核心：被动收入 ≥ 生活支出</li>
            <li>先积累本金，再追求被动收入的增长</li>
            <li>控制支出增长比提高收入更容易实现</li>
            <li>多元化被动收入来源，降低单一风险</li>
            <li>定期审视主动收入分类配置，确保分析准确</li>
          </ul>
        </LayerCard.Body>
      </LayerCard>
    </div>
  );
}
