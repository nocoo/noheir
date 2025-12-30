import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, XCircle, TrendingUp, Wallet, PiggyBank, Target, HeartPulse } from 'lucide-react';
import { useMemo } from 'react';

interface FinancialHealthScoreProps {
  totalIncome: number;
  totalExpense: number;
  savingsRate: number;
  monthlyData: { income: number; expense: number }[];
  year?: number;
}

interface HealthMetric {
  name: string;
  score: number;
  maxScore: number;
  status: 'good' | 'warning' | 'poor';
  description: string;
  icon: React.ElementType;
}

export function FinancialHealthScore({
  totalIncome,
  totalExpense,
  savingsRate,
  monthlyData,
  year
}: FinancialHealthScoreProps) {
  // Calculate health metrics with useMemo to recalculate when data changes
  const metrics = useMemo((): HealthMetric[] => {
    // Calculate various health metrics
    const getSavingsScore = (): number => {
      if (savingsRate >= 30) return 30;
      if (savingsRate >= 20) return 25;
      if (savingsRate >= 10) return 20;
      if (savingsRate >= 0) return 10;
      return 0;
    };

    const getStabilityScore = (): number => {
      const incomes = monthlyData.filter(d => d.income > 0).map(d => d.income);
      if (incomes.length < 2) return 20;
      const avgIncome = incomes.reduce((a, b) => a + b, 0) / incomes.length;
      const variance = incomes.reduce((sum, val) => sum + Math.pow(val - avgIncome, 2), 0) / incomes.length;
      const cv = Math.sqrt(variance) / avgIncome; // Coefficient of variation
      if (cv < 0.1) return 25;
      if (cv < 0.2) return 20;
      if (cv < 0.3) return 15;
      return 10;
    };

    const getBalanceScore = (): number => {
      const positiveMonths = monthlyData.filter(d => d.income > d.expense).length;
      const ratio = positiveMonths / monthlyData.length;
      if (ratio >= 0.9) return 25;
      if (ratio >= 0.7) return 20;
      if (ratio >= 0.5) return 15;
      return 10;
    };

    const getDiversityScore = (): number => {
      // This would ideally check income sources - simplified version
      const hasIncome = monthlyData.some(d => d.income > 0);
      return hasIncome ? 20 : 10;
    };

    const stabilityScore = getStabilityScore();
    const balanceScore = getBalanceScore();
    const diversityScore = getDiversityScore();

    return [
      {
        name: '储蓄能力',
        score: getSavingsScore(),
        maxScore: 30,
        status: savingsRate >= 20 ? 'good' : savingsRate >= 10 ? 'warning' : 'poor',
        description: `储蓄率 ${savingsRate.toFixed(1)}%`,
        icon: PiggyBank,
      },
      {
        name: '收入稳定性',
        score: stabilityScore,
        maxScore: 25,
        status: stabilityScore >= 20 ? 'good' : stabilityScore >= 15 ? 'warning' : 'poor',
        description: '收入波动分析',
        icon: TrendingUp,
      },
      {
        name: '收支平衡',
        score: balanceScore,
        maxScore: 25,
        status: balanceScore >= 20 ? 'good' : balanceScore >= 15 ? 'warning' : 'poor',
        description: '盈余月份占比',
        icon: Wallet,
      },
      {
        name: '财务规划',
        score: diversityScore,
        maxScore: 20,
        status: diversityScore >= 15 ? 'good' : 'warning',
        description: '收入来源多样性',
        icon: Target,
      },
    ];
  }, [savingsRate, monthlyData]);

  const totalScore = metrics.reduce((sum, m) => sum + m.score, 0);
  const maxTotalScore = metrics.reduce((sum, m) => sum + m.maxScore, 0);
  const scorePercentage = (totalScore / maxTotalScore) * 100;

  const getOverallStatus = () => {
    if (scorePercentage >= 80) return { label: '优秀', color: 'text-primary', bg: 'bg-primary' };
    if (scorePercentage >= 60) return { label: '良好', color: 'text-chart-2', bg: 'bg-chart-2' };
    if (scorePercentage >= 40) return { label: '一般', color: 'text-accent-foreground', bg: 'bg-accent-foreground' };
    return { label: '需改善', color: 'text-destructive', bg: 'bg-destructive' };
  };

  const status = getOverallStatus();
  const StatusIcon = scorePercentage >= 60 ? CheckCircle2 : scorePercentage >= 40 ? AlertCircle : XCircle;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" />
          财务健康评分
        </CardTitle>
        <CardDescription>基于您的财务数据综合评估</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row items-stretch gap-8">
          {/* Left: Pie chart + Status as one unit */}
          <div className="flex flex-col items-center justify-center gap-4 shrink-0 min-w-[200px]">
            {/* Pie chart */}
            <div className="relative">
              <svg className="w-36 h-36 transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r="60"
                  stroke="hsl(var(--border))"
                  strokeWidth="10"
                  fill="none"
                />
                <circle
                  cx="72"
                  cy="72"
                  r="60"
                  stroke="hsl(var(--primary))"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${scorePercentage * 3.77} 377`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold">{totalScore}</span>
                <span className="text-xs text-muted-foreground">/ {maxTotalScore}</span>
              </div>
            </div>
            {/* Status below pie chart */}
            <div className="text-center">
              <div className={cn('flex items-center justify-center gap-2 text-2xl font-semibold', status.color)}>
                <StatusIcon className="h-7 w-7" />
                {status.label}
              </div>
              <p className="text-sm text-muted-foreground mt-1">财务健康状态</p>
            </div>
          </div>

          {/* Right: Individual Metrics as another unit */}
          <div className="flex-1 space-y-4">
            {metrics.map((metric) => (
              <div key={metric.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <metric.icon className={cn(
                      'h-4 w-4',
                      metric.status === 'good' ? 'text-primary' :
                      metric.status === 'warning' ? 'text-accent-foreground' : 'text-destructive'
                    )} />
                    <span className="font-medium text-sm">{metric.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {metric.score} / {metric.maxScore}
                  </span>
                </div>
                <Progress
                  value={(metric.score / metric.maxScore) * 100}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">{metric.description}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
