import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, XCircle, HeartPulse, TrendingUp, Shield, Target, Zap, PiggyBank, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { Transaction } from '@/types/transaction';
import { calculateFinancialHealth, FinancialHealthResult } from '@/lib/financial-health-algorithm';
import { useSettings } from '@/contexts/SettingsContext';

interface FinancialHealthScoreProps {
  transactions: Transaction[];
  totalIncome: number;
  totalExpense: number;
  savingsRate: number;
  monthlyData: { month: string; income: number; expense: number; balance: number }[];
  year?: number;
}

interface HealthMetric {
  name: string;
  score: number;
  maxScore: number;
  status: 'good' | 'warning' | 'poor';
  description: string;
  reason: string;
  icon: React.ElementType;
}

export function FinancialHealthScore({
  transactions,
  totalIncome,
  totalExpense,
  savingsRate,
  monthlyData,
  year
}: FinancialHealthScoreProps) {
  const { settings } = useSettings();

  // Calculate health score using the new algorithm
  const healthResult = useMemo(() => {
    return calculateFinancialHealth(
      transactions,
      monthlyData,
      totalIncome,
      settings.fixedExpenseCategories
    );
  }, [transactions, monthlyData, totalIncome, settings.fixedExpenseCategories]);

  // Transform result into metrics for display
  const metrics = useMemo((): HealthMetric[] => {
    const { dimensions } = healthResult;

    // Generate reasons based on scores
    const growthReason = dimensions.growth.score >= 15
      ? '收入增长强劲，跑赢支出'
      : dimensions.growth.score >= 10
      ? '收支增长基本持平'
      : '支出增长快于收入，需警惕';

    const rigidityReason = dimensions.rigidity.score >= 20
      ? '固定支出占比合理'
      : dimensions.rigidity.score >= 15
      ? '固定支出略高'
      : '固定支出占比过高，风险大';

    const qualityReason = dimensions.quality.score >= 12
      ? '收入来源多元化'
      : dimensions.quality.score >= 8
      ? '收入来源较单一'
      : '严重依赖单一收入';

    const resilienceReason = dimensions.resilience.score >= 15
      ? '现金流稳定健康'
      : dimensions.resilience.score >= 10
      ? '偶有负现金流'
      : '频繁入不敷出';

    const savingsReason = dimensions.savings.score >= 15
      ? '储蓄能力优秀'
      : dimensions.savings.score >= 10
      ? '储蓄能力一般'
      : '储蓄严重不足';

    return [
      {
        name: '成长性',
        score: dimensions.growth.score,
        maxScore: dimensions.growth.maxScore,
        status: dimensions.growth.score >= 15 ? 'good' : dimensions.growth.score >= 10 ? 'warning' : 'poor',
        description: '剪刀差动能分析',
        reason: growthReason,
        icon: TrendingUp,
      },
      {
        name: '刚性',
        score: dimensions.rigidity.score,
        maxScore: dimensions.rigidity.maxScore,
        status: dimensions.rigidity.score >= 20 ? 'good' : dimensions.rigidity.score >= 15 ? 'warning' : 'poor',
        description: `固定支出 ${(dimensions.rigidity.details.fixedExpenseRatio * 100).toFixed(0)}%`,
        reason: rigidityReason,
        icon: Shield,
      },
      {
        name: '质量',
        score: dimensions.quality.score,
        maxScore: dimensions.quality.maxScore,
        status: dimensions.quality.score >= 12 ? 'good' : dimensions.quality.score >= 8 ? 'warning' : 'poor',
        description: `${dimensions.quality.details.incomeSourceCount} 个收入来源`,
        reason: qualityReason,
        icon: Target,
      },
      {
        name: '韧性',
        score: dimensions.resilience.score,
        maxScore: dimensions.resilience.maxScore,
        status: dimensions.resilience.score >= 15 ? 'good' : dimensions.resilience.score >= 10 ? 'warning' : 'poor',
        description: `${dimensions.resilience.details.negativeCashflowMonths}月负流`,
        reason: resilienceReason,
        icon: Zap,
      },
      {
        name: '储蓄力',
        score: dimensions.savings.score,
        maxScore: dimensions.savings.maxScore,
        status: dimensions.savings.score >= 15 ? 'good' : dimensions.savings.score >= 10 ? 'warning' : 'poor',
        description: `储蓄率 ${(dimensions.savings.details.weightedSavingsRate * 100).toFixed(0)}%`,
        reason: savingsReason,
        icon: PiggyBank,
      },
    ];
  }, [healthResult]);

  const { totalScore, maxScore, grade } = healthResult;
  const scorePercentage = (totalScore / maxScore) * 100;

  const getGradeColor = () => {
    switch (grade) {
      case 'A+':
      case 'A':
        return { color: 'text-primary', bg: 'bg-primary/10', borderColor: 'border-primary/50' };
      case 'B':
        return { color: 'text-chart-2', bg: 'bg-chart-2/10', borderColor: 'border-chart-2/50' };
      case 'C':
        return { color: 'text-yellow-600', bg: 'bg-yellow-100', borderColor: 'border-yellow-600/50' };
      default:
        return { color: 'text-destructive', bg: 'bg-destructive/10', borderColor: 'border-destructive/50' };
    }
  };

  const gradeStyle = getGradeColor();
  const StatusIcon = scorePercentage >= 80 ? CheckCircle2 : scorePercentage >= 60 ? AlertCircle : XCircle;

  return (
    <Card className={cn('border-2', gradeStyle.borderColor)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HeartPulse className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>财务健康评分</CardTitle>
              <CardDescription>5维度反脆弱评估</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className={cn('flex items-center justify-end gap-1 text-xl font-bold', gradeStyle.color)}>
                <StatusIcon className="h-5 w-5" />
                {totalScore}
                <span className="text-sm text-muted-foreground">/ {maxScore}</span>
              </div>
              <Badge variant="outline" className={cn('text-xs', gradeStyle.bg, gradeStyle.color)}>
                {grade}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {metrics.map((metric) => (
            <div key={metric.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <metric.icon className={cn(
                    'h-3.5 w-3.5',
                    metric.status === 'good' ? 'text-primary' :
                    metric.status === 'warning' ? 'text-yellow-600' : 'text-destructive'
                  )} />
                  <span className="font-medium">{metric.name}</span>
                  <Badge variant="outline" className="text-xs py-0 h-5">
                    {metric.description}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{metric.reason}</span>
                  <span className={cn(
                    'text-xs font-medium',
                    metric.status === 'good' ? 'text-primary' :
                    metric.status === 'warning' ? 'text-yellow-600' : 'text-destructive'
                  )}>
                    {metric.score}/{metric.maxScore}
                  </span>
                </div>
              </div>
              <Progress
                value={(metric.score / metric.maxScore) * 100}
                className="h-1.5"
              />
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          className="w-full mt-4"
          onClick={() => {
            const tabElement = document.querySelector('[data-value="financial-health"]') as HTMLElement;
            tabElement?.click();
          }}
        >
          查看详细分析
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
