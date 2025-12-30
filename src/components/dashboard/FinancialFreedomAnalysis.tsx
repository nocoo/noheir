import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Calculator,
  CheckCircle2,
  ArrowDown,
  ArrowUp,
  Minus
} from 'lucide-react';
import { Transaction } from '@/types/transaction';
import { useSettings } from '@/contexts/SettingsContext';
import { DEFAULT_INCOME_CATEGORIES } from '@/types/category';
import { formatCurrencyFull } from '@/lib/chart-config';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface FinancialFreedomAnalysisProps {
  transactions: Transaction[];
  year: number | null;
}

interface ScenarioResult {
  targetValue: number;
  currentValue: number;
  gap: number;
  percentage: number;
  isAchieved: boolean;
}

export function FinancialFreedomAnalysis({ transactions, year }: FinancialFreedomAnalysisProps) {
  const { settings } = useSettings();
  const activeIncomeCategories = settings.activeIncomeCategories || [];

  // Get all income tertiary categories from active income secondary categories
  const getActiveIncomeTertiaryCategories = (): string[] => {
    const categories: string[] = [];
    for (const [secondary, tertiaries] of Object.entries(DEFAULT_INCOME_CATEGORIES)) {
      if (activeIncomeCategories.includes(secondary)) {
        categories.push(...tertiaries);
      }
    }
    return categories;
  };

  const activeIncomeTertiaryCategories = getActiveIncomeTertiaryCategories();

  // Calculate income breakdown
  const calculateIncomeBreakdown = () => {
    let totalIncome = 0;
    let activeIncome = 0;
    let passiveIncome = 0;

    const activeByCategory = new Map<string, number>();
    const passiveByCategory = new Map<string, number>();

    transactions
      .filter(t => t.type === 'income')
      .forEach(t => {
        totalIncome += t.amount;

        const isActive = activeIncomeTertiaryCategories.includes(t.tertiaryCategory) ||
                        activeIncomeCategories.includes(t.secondaryCategory);

        if (isActive) {
          activeIncome += t.amount;
          const key = t.secondaryCategory || t.tertiaryCategory;
          activeByCategory.set(key, (activeByCategory.get(key) || 0) + t.amount);
        } else {
          passiveIncome += t.amount;
          const key = t.secondaryCategory || t.tertiaryCategory;
          passiveByCategory.set(key, (passiveByCategory.get(key) || 0) + t.amount);
        }
      });

    return { totalIncome, activeIncome, passiveIncome, activeByCategory, passiveByCategory };
  };

  // Calculate total expense
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const { totalIncome, activeIncome, passiveIncome, activeByCategory, passiveByCategory } = calculateIncomeBreakdown();

  // Financial freedom status
  const isFree = passiveIncome >= totalExpense;
  const freedomGap = totalExpense - passiveIncome;
  const freedomRatio = totalExpense > 0 ? (passiveIncome / totalExpense) * 100 : 0;

  // What-if scenarios
  // Scenario 1: Reduce expenses
  const [expenseReductionPercent, setExpenseReductionPercent] = useState(20);
  const scenario1: ScenarioResult = {
    targetValue: passiveIncome,
    currentValue: totalExpense * (1 - expenseReductionPercent / 100),
    gap: totalExpense * (1 - expenseReductionPercent / 100) - passiveIncome,
    percentage: totalExpense > 0 ? (passiveIncome / (totalExpense * (1 - expenseReductionPercent / 100))) * 100 : 0,
    isAchieved: passiveIncome >= totalExpense * (1 - expenseReductionPercent / 100)
  };

  // Scenario 2: Increase passive income
  const [passiveIncomeIncreasePercent, setPassiveIncomeIncreasePercent] = useState(50);
  const scenario2TargetIncome = passiveIncome * (1 + passiveIncomeIncreasePercent / 100);
  const scenario2: ScenarioResult = {
    targetValue: scenario2TargetIncome,
    currentValue: totalExpense,
    gap: totalExpense - scenario2TargetIncome,
    percentage: totalExpense > 0 ? (scenario2TargetIncome / totalExpense) * 100 : 0,
    isAchieved: scenario2TargetIncome >= totalExpense
  };

  // Calculate required expense reduction to achieve freedom
  const requiredExpenseReduction = totalExpense > 0 ? ((totalExpense - passiveIncome) / totalExpense) * 100 : 0;

  // Calculate required passive income increase to achieve freedom
  const requiredPassiveIncrease = passiveIncome > 0 ? ((totalExpense - passiveIncome) / passiveIncome) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className={cn(
        "border-2",
        isFree ? "border-income bg-income/5" : "border-expense bg-expense/5"
      )}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {isFree ? (
              <CheckCircle2 className="h-8 w-8 text-income" />
            ) : (
              <Target className="h-8 w-8 text-expense" />
            )}
            <span>{year}年 财务自由分析</span>
          </CardTitle>
          <CardDescription>
            {isFree
              ? "恭喜！您的被动收入已覆盖全部支出，实现财务自由！"
              : "距离财务自由还有差距，查看下方试算方案"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Passive Income */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">被动收入</span>
                <Badge variant="outline" className="text-income border-income/30">
                  {formatCurrencyFull(passiveIncome)}
                </Badge>
              </div>
              <Progress value={Math.min(freedomRatio, 100)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                占支出 {freedomRatio.toFixed(1)}%
              </p>
            </div>

            {/* Total Expense */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">年度支出</span>
                <Badge variant="outline" className="text-expense border-expense/30">
                  {formatCurrencyFull(totalExpense)}
                </Badge>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-expense" style={{ width: '100%' }} />
              </div>
              <p className="text-xs text-muted-foreground">目标 100%</p>
            </div>

            {/* Gap */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {isFree ? "盈余" : "缺口"}
                </span>
                <Badge
                  variant={isFree ? "default" : "destructive"}
                  className={cn(isFree && "bg-income text-income-foreground")}
                >
                  {formatCurrencyFull(Math.abs(freedomGap))}
                </Badge>
              </div>
              {isFree ? (
                <div className="h-2 bg-income/20 rounded-full overflow-hidden">
                  <div className="h-full bg-income" style={{ width: '100%' }} />
                </div>
              ) : (
                <div className="h-2 bg-expense/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-expense"
                    style={{ width: `${Math.min(100, freedomRatio)}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {isFree ? "已实现财务自由" : `还需 ${formatCurrencyFull(freedomGap)} 被动收入`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Income Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Income */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              主动收入明细
            </CardTitle>
            <CardDescription>
              已设置 {activeIncomeCategories.length} 个主动收入分类
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <span className="font-medium">主动收入总计</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrencyFull(activeIncome)}
              </span>
            </div>
            {Array.from(activeByCategory.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{category}</span>
                  <span className="font-medium">{formatCurrencyFull(amount)}</span>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Passive Income */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-chart-2" />
              被动收入明细
            </CardTitle>
            <CardDescription>
              投资收益、房租等非劳动收入
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-chart-2/10 rounded-lg">
              <span className="font-medium">被动收入总计</span>
              <span className="text-lg font-bold text-chart-2">
                {formatCurrencyFull(passiveIncome)}
              </span>
            </div>
            {Array.from(passiveByCategory.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{category}</span>
                  <span className="font-medium">{formatCurrencyFull(amount)}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* What-If Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            财务自由试算
          </CardTitle>
          <CardDescription>
            调整参数，查看实现财务自由的路径
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="reduce-expense" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="reduce-expense">
                <ArrowDown className="h-4 w-4 mr-2" />
                减少开支
              </TabsTrigger>
              <TabsTrigger value="increase-income">
                <ArrowUp className="h-4 w-4 mr-2" />
                增加被动收入
              </TabsTrigger>
            </TabsList>

            {/* Scenario 1: Reduce Expense */}
            <TabsContent value="reduce-expense" className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>目标支出减少比例</Label>
                    <span className="text-2xl font-bold text-primary">
                      {expenseReductionPercent}%
                    </span>
                  </div>
                  <Slider
                    value={[expenseReductionPercent]}
                    onValueChange={(v) => setExpenseReductionPercent(v[0])}
                    min={0}
                    max={Math.max(100, Math.ceil(requiredExpenseReduction))}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">当前年度支出</span>
                    <span className="font-medium">{formatCurrencyFull(totalExpense)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">减少后支出</span>
                    <span className="font-medium text-primary">
                      {formatCurrencyFull(scenario1.currentValue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">当前被动收入</span>
                    <span className="font-medium text-chart-2">
                      {formatCurrencyFull(passiveIncome)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-3">
                    {scenario1.isAchieved ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-income">实现财务自由！</span>
                        <CheckCircle2 className="h-5 w-5 text-income" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">仍需缺口</span>
                        <span className="font-medium text-expense">
                          {formatCurrencyFull(Math.abs(scenario1.gap))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {!scenario1.isAchieved && requiredExpenseReduction > 0 && (
                  <div className="p-4 bg-expense/10 rounded-lg">
                    <p className="text-sm">
                      要实现财务自由，需要将支出减少到 <span className="font-bold text-expense">
                        {formatCurrencyFull(passiveIncome)}
                      </span>，即减少 <span className="font-bold">
                        {requiredExpenseReduction.toFixed(1)}%
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Scenario 2: Increase Passive Income */}
            <TabsContent value="increase-income" className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>目标被动收入增长</Label>
                    <span className="text-2xl font-bold text-primary">
                      +{passiveIncomeIncreasePercent}%
                    </span>
                  </div>
                  <Slider
                    value={[passiveIncomeIncreasePercent]}
                    onValueChange={(v) => setPassiveIncomeIncreasePercent(v[0])}
                    min={0}
                    max={Math.max(100, Math.ceil(requiredPassiveIncrease))}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                    <span>200%</span>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">当前被动收入</span>
                    <span className="font-medium text-chart-2">
                      {formatCurrencyFull(passiveIncome)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">增长后被动收入</span>
                    <span className="font-medium text-primary">
                      {formatCurrencyFull(scenario2.targetValue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">年度支出</span>
                    <span className="font-medium">{formatCurrencyFull(totalExpense)}</span>
                  </div>
                  <div className="border-t border-border pt-3">
                    {scenario2.isAchieved ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-income">实现财务自由！</span>
                        <CheckCircle2 className="h-5 w-5 text-income" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">仍需缺口</span>
                        <span className="font-medium text-expense">
                          {formatCurrencyFull(Math.abs(scenario2.gap))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {!scenario2.isAchieved && passiveIncome > 0 && (
                  <div className="p-4 bg-expense/10 rounded-lg">
                    <p className="text-sm">
                      要实现财务自由，需要将被动收入增加到 <span className="font-bold text-expense">
                        {formatCurrencyFull(totalExpense)}
                      </span>，即增长 <span className="font-bold">
                        {requiredPassiveIncrease.toFixed(1)}%
                      </span>，约 <span className="font-bold">
                        {formatCurrencyFull(totalExpense - passiveIncome)}
                      </span>
                    </p>
                  </div>
                )}

                {passiveIncome === 0 && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      当前没有被动收入。请先配置被动收入来源（投资、房租等），财务自由需要被动收入来覆盖支出。
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Target className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium">财务自由小贴士</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• 财务自由 = 被动收入 ≥ 生活支出</li>
                <li>• 主动收入需要劳动才能获得，被动收入可以自动产生</li>
                <li>• 在设置中配置哪些收入属于主动收入，哪些属于被动收入</li>
                <li>• 两条路径：降低生活必需开支，或增加投资性被动收入</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
