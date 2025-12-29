import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, XCircle, TrendingUp, Wallet, PiggyBank, Target } from 'lucide-react';

interface FinancialHealthScoreProps {
  totalIncome: number;
  totalExpense: number;
  savingsRate: number;
  monthlyData: { income: number; expense: number }[];
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
  monthlyData 
}: FinancialHealthScoreProps) {
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

  const metrics: HealthMetric[] = [
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
      score: getStabilityScore(),
      maxScore: 25,
      status: getStabilityScore() >= 20 ? 'good' : getStabilityScore() >= 15 ? 'warning' : 'poor',
      description: '收入波动分析',
      icon: TrendingUp,
    },
    {
      name: '收支平衡',
      score: getBalanceScore(),
      maxScore: 25,
      status: getBalanceScore() >= 20 ? 'good' : getBalanceScore() >= 15 ? 'warning' : 'poor',
      description: '盈余月份占比',
      icon: Wallet,
    },
    {
      name: '财务规划',
      score: getDiversityScore(),
      maxScore: 20,
      status: getDiversityScore() >= 15 ? 'good' : 'warning',
      description: '收入来源多样性',
      icon: Target,
    },
  ];

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
        <CardTitle>财务健康评分</CardTitle>
        <CardDescription>基于您的财务数据综合评估</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="flex items-center justify-center gap-6">
          <div className="relative">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="hsl(var(--border))"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="hsl(var(--primary))"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${scorePercentage * 3.52} 352`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{totalScore}</span>
              <span className="text-xs text-muted-foreground">/ {maxTotalScore}</span>
            </div>
          </div>
          <div className="text-center">
            <div className={cn('flex items-center gap-2 text-xl font-semibold', status.color)}>
              <StatusIcon className="h-6 w-6" />
              {status.label}
            </div>
            <p className="text-sm text-muted-foreground mt-1">财务健康状态</p>
          </div>
        </div>

        {/* Individual Metrics */}
        <div className="space-y-4">
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
      </CardContent>
    </Card>
  );
}
