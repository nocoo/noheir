import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, XCircle, HeartPulse, TrendingUp, Shield, Target, Zap, PiggyBank, Info, Settings } from 'lucide-react';
import { useMemo } from 'react';
import { Transaction } from '@/types/transaction';
import { calculateFinancialHealth, FinancialHealthResult } from '@/lib/financial-health-algorithm';
import { FinancialHealthRadar } from '@/components/charts/FinancialHealthRadar';
import { useSettings } from '@/contexts/SettingsContext';
import { ScissorsTrendChart } from '@/components/charts/ScissorsTrendChart';
import { RigiditySankey } from '@/components/charts/RigiditySankey';
import { UnifiedYearSelector } from '@/components/dashboard/UnifiedYearSelector';
import { IncomeExpenseComparison } from '@/components/dashboard/IncomeExpenseComparison';
import { getScoreRatingColors } from '@/lib/colorPalette';

interface FinancialHealthPageProps {
  transactions: Transaction[];
  totalIncome: number;
  totalExpense: number;
  savingsRate: number;
  monthlyData: { month: string; income: number; expense: number; balance: number }[];
  selectedYear: number | null;
  availableYears: number[];
  onYearChange: (year: number | null) => void;
}

interface DimensionAnalysis {
  name: string;
  score: number;
  maxScore: number;
  status: 'good' | 'warning' | 'poor';
  description: string;
  details: string;
  icon: React.ElementType;
  recommendation: string;
  analysis: string[];
  scoringRules: React.ReactNode;
  settingsAlert?: {
    message: string;
    actionLabel: string;
    onAction: () => void;
  };
}

export function FinancialHealthPage({
  transactions,
  totalIncome,
  totalExpense,
  savingsRate,
  monthlyData,
  selectedYear,
  availableYears,
  onYearChange,
}: FinancialHealthPageProps) {
  const { settings } = useSettings();
  const safeMonthlyData = useMemo(
    () => (Array.isArray(monthlyData) ? monthlyData : []),
    [monthlyData]
  );
  const safeTotalIncome = Number.isFinite(totalIncome) ? totalIncome : 0;

  // Helper component for scoring rule items with unified colors
  const ScoreRuleItem = ({ score, description }: { score: string; description: string }) => {
    const scoreNum = parseInt(score);
    const colors = getScoreRatingColors(scoreNum);
    return (
      <li>
        • <span className={colors.text}>{score}分</span>: {description}
      </li>
    );
  };

  // Calculate health score using the new algorithm
  const healthResult = useMemo(() => {
    return calculateFinancialHealth(
      transactions,
      safeMonthlyData,
      safeTotalIncome,
      settings.fixedExpenseCategories
    );
  }, [transactions, safeMonthlyData, safeTotalIncome, settings.fixedExpenseCategories]);

  // Transform result into metrics for display
  const dimensions = useMemo((): DimensionAnalysis[] => {
    const { dimensions } = healthResult;
    const fixedCategories = settings.fixedExpenseCategories;

    // Prepare rigidity analysis with fixed expense categories
    const rigidityAnalysis = [
      `固定支出金额: ¥${dimensions.rigidity.details.fixedExpenseAmount.toLocaleString()}`,
      `总收入: ¥${dimensions.rigidity.details.totalIncome.toLocaleString()}`,
      `固定支出占比: ${(dimensions.rigidity.details.fixedExpenseRatio * 100).toFixed(1)}%`,
      `理想水平: <30%`,
    ];

    // Add current fixed expense categories to analysis
    if (fixedCategories.length > 0) {
      rigidityAnalysis.push(`当前固定支出分类 (${fixedCategories.length}个):`);
      // Show up to 5 categories, add "..." if more
      const displayCategories = fixedCategories.slice(0, 5);
      displayCategories.forEach(cat => {
        rigidityAnalysis.push(`  • ${cat}`);
      });
      if (fixedCategories.length > 5) {
        rigidityAnalysis.push(`  • ...还有 ${fixedCategories.length - 5} 个分类`);
      }
    }

    // Create settings alert if no fixed categories configured
    const rigiditySettingsAlert = fixedCategories.length === 0 ? {
      message: '尚未设置固定支出分类，请在设置中配置哪些支出属于固定支出（如房贷、保险等）',
      actionLabel: '前往设置',
      onAction: () => {
        const tabElement = document.querySelector('[data-value="settings"]') as HTMLElement;
        tabElement?.click();
      },
    } : undefined;

    return [
      {
        name: '成长性',
        score: dimensions.growth.score,
        maxScore: dimensions.growth.maxScore,
        status: dimensions.growth.score >= 15 ? 'good' : dimensions.growth.score >= 10 ? 'warning' : 'poor',
        description: '剪刀差动能分析',
        details: dimensions.growth.details.interpretation,
        icon: TrendingUp,
        recommendation: dimensions.growth.score >= 15
          ? '收入增长强劲，建议保持当前投资策略，适当增加资产配置'
          : dimensions.growth.score >= 10
          ? '收入增长平稳，建议控制支出增长速度，避免入不敷出'
          : '支出增长过快，建议立即审查并削减非必要开支',
        analysis: [
          `收入趋势斜率: ${dimensions.growth.details.incomeSlope.toFixed(2)}`,
          `支出趋势斜率: ${dimensions.growth.details.expenseSlope.toFixed(2)}`,
          `趋势差异: ${dimensions.growth.details.trendDifference.toFixed(2)}`,
        ],
        scoringRules: (
          <ul className="space-y-1">
            <ScoreRuleItem score="20" description="收入增长快于支出增长（剪刀差为正）" />
            <ScoreRuleItem score="15" description="收支增长基本持平" />
            <ScoreRuleItem score="10" description="支出增长略快于收入" />
            <ScoreRuleItem score="5" description="支出增长明显快于收入" />
          </ul>
        ),
      },
      {
        name: '刚性',
        score: dimensions.rigidity.score,
        maxScore: dimensions.rigidity.maxScore,
        status: dimensions.rigidity.score >= 20 ? 'good' : dimensions.rigidity.score >= 15 ? 'warning' : 'poor',
        description: `固定支出占比 ${(dimensions.rigidity.details.fixedExpenseRatio * 100).toFixed(1)}%`,
        details: dimensions.rigidity.details.interpretation,
        icon: Shield,
        recommendation: dimensions.rigidity.score >= 20
          ? '财务结构健康，有足够空间应对收入波动'
          : dimensions.rigidity.score >= 15
          ? '固定支出适中，建议预留3-6个月应急资金'
          : '固定支出过高，失业风险大，建议建立更厚的应急储备',
        analysis: rigidityAnalysis,
        scoringRules: (
          <ul className="space-y-1">
            <ScoreRuleItem score="25" description="固定支出占比 ≤30%（财务结构健康）" />
            <ScoreRuleItem score="20" description="固定支出占比 30-40%" />
            <ScoreRuleItem score="15" description="固定支出占比 40-50%" />
            <ScoreRuleItem score="10" description="固定支出占比 50-60%" />
            <ScoreRuleItem score="5" description="固定支出占比 &gt;60%（风险很高）" />
          </ul>
        ),
        settingsAlert: rigiditySettingsAlert,
      },
      {
        name: '质量',
        score: dimensions.quality.score,
        maxScore: dimensions.quality.maxScore,
        status: dimensions.quality.score >= 12 ? 'good' : dimensions.quality.score >= 8 ? 'warning' : 'poor',
        description: `${dimensions.quality.details.incomeSourceCount} 个收入来源`,
        details: dimensions.quality.details.interpretation,
        icon: Target,
        recommendation: dimensions.quality.score >= 12
          ? '收入来源多元化，抗风险能力强，可考虑扩大投资版图'
          : dimensions.quality.score >= 8
          ? '收入来源较单一，建议发展副业或被动收入'
          : '严重依赖单一收入来源，风险极高，急需多元化',
        analysis: [
          `收入来源数量: ${dimensions.quality.details.incomeSourceCount}`,
          `HHI 指数: ${dimensions.quality.details.hhi.toFixed(3)}`,
          `HHI 越低表示收入越多元化`,
        ],
        scoringRules: (
          <ul className="space-y-1">
            <ScoreRuleItem score="15" description="HHI ≤0.3（收入来源高度多元化）" />
            <ScoreRuleItem score="12" description="HHI 0.3-0.5（较多元化）" />
            <ScoreRuleItem score="9" description="HHI 0.5-0.7（有一定集中度）" />
            <ScoreRuleItem score="6" description="HHI 0.7-0.85（高度集中）" />
            <ScoreRuleItem score="3" description="HHI &gt;0.85（严重依赖单一来源）" />
          </ul>
        ),
      },
      {
        name: '韧性',
        score: dimensions.resilience.score,
        maxScore: dimensions.resilience.maxScore,
        status: dimensions.resilience.score >= 15 ? 'good' : dimensions.resilience.score >= 10 ? 'warning' : 'poor',
        description: `${dimensions.resilience.details.negativeCashflowMonths}/${dimensions.resilience.details.totalMonths} 月负流`,
        details: dimensions.resilience.details.interpretation,
        icon: Zap,
        recommendation: dimensions.resilience.score >= 15
          ? '现金流稳定，可适当增加高风险高回报投资'
          : dimensions.resilience.score >= 10
          ? '偶有负流，建议加强现金流管理，保持流动性'
          : '经常入不敷出，急需建立预算制度和紧急备用金',
        analysis: [
          `负现金流月份: ${dimensions.resilience.details.negativeCashflowMonths}`,
          `总月份数: ${dimensions.resilience.details.totalMonths}`,
          `现金流波动率(CV): ${dimensions.resilience.details.cashflowCV.toFixed(3)}`,
          `CV 越低表示现金流越稳定`,
        ],
        scoringRules: (
          <ul className="space-y-1">
            <ScoreRuleItem score="20" description="从未负现金流且波动率低" />
            <ScoreRuleItem score="16" description="偶有负流（≤10%月份）且波动适中" />
            <ScoreRuleItem score="12" description="部分月份负流（10-20%）" />
            <ScoreRuleItem score="8" description="频繁负流（20-30%）" />
            <ScoreRuleItem score="4" description="经常入不敷出（&gt;30%月份）" />
          </ul>
        ),
      },
      {
        name: '储蓄力',
        score: dimensions.savings.score,
        maxScore: dimensions.savings.maxScore,
        status: dimensions.savings.score >= 15 ? 'good' : dimensions.savings.score >= 10 ? 'warning' : 'poor',
        description: `年度储蓄率 ${(dimensions.savings.details.weightedSavingsRate * 100).toFixed(1)}%`,
        details: dimensions.savings.details.interpretation,
        icon: PiggyBank,
        recommendation: dimensions.savings.score >= 15
          ? '储蓄能力优秀，可加速资产积累，考虑税务优化策略'
          : dimensions.savings.score >= 10
          ? '储蓄能力一般，建议设定自动储蓄计划，优先支付自己'
          : '储蓄严重不足，建议从最小额度开始建立储蓄习惯',
        analysis: [
          `年度储蓄率: ${(dimensions.savings.details.weightedSavingsRate * 100).toFixed(1)}%`,
          `基于全年累计计算(总储蓄/总收入)`,
          `健康储蓄率: >20%`,
        ],
        scoringRules: (
          <ul className="space-y-1">
            <ScoreRuleItem score="20" description="年度储蓄率 ≥30%" />
            <ScoreRuleItem score="16" description="年度储蓄率 20-30%" />
            <ScoreRuleItem score="12" description="年度储蓄率 10-20%" />
            <ScoreRuleItem score="8" description="年度储蓄率 0-10%" />
            <ScoreRuleItem score="0" description="年度储蓄率 &lt;0%（入不敷出）" />
          </ul>
        ),
      },
    ];
  }, [healthResult, settings.fixedExpenseCategories]);

  const { totalScore, maxScore, grade } = healthResult;
  const scorePercentage = (totalScore / maxScore) * 100;

  const getGradeColor = () => {
    switch (grade) {
      case 'A+':
      case 'A':
        return { color: 'text-primary', bg: 'bg-primary/10', borderColor: 'border-primary' };
      case 'B':
        return { color: 'text-chart-2', bg: 'bg-chart-2/10', borderColor: 'border-chart-2' };
      case 'C':
        return { color: 'text-yellow-600', bg: 'bg-yellow-100', borderColor: 'border-yellow-600' };
      default:
        return { color: 'text-destructive', bg: 'bg-destructive/10', borderColor: 'border-destructive' };
    }
  };

  const gradeStyle = getGradeColor();
  const StatusIcon = scorePercentage >= 80 ? CheckCircle2 : scorePercentage >= 60 ? AlertCircle : XCircle;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">财务健康分析</h1>
          <p className="text-muted-foreground">5维度反脆弱评估体系</p>
        </div>
        <UnifiedYearSelector mode="single" selectedYear={selectedYear} availableYears={availableYears} onChange={onYearChange} />
      </div>

      {/* Overall Score Card */}
      <Card className={cn('border-2', gradeStyle.borderColor)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HeartPulse className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-xl">综合评分</CardTitle>
                <CardDescription>基于 {safeMonthlyData.length} 个月数据评估</CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className={cn('flex items-center justify-center gap-2 text-3xl font-bold', gradeStyle.color)}>
                <StatusIcon className="h-8 w-8" />
                {totalScore}
                <span className="text-lg text-muted-foreground">/ {maxScore}</span>
              </div>
              <Badge variant="outline" className={cn('mt-1 text-base px-3 py-0', gradeStyle.bg, gradeStyle.color)}>
                等级 {grade}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Income/Expense Comparison Chart */}
      <IncomeExpenseComparison data={safeMonthlyData} />

      {/* Detailed Analysis Tabs */}
      <Tabs defaultValue="dimensions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dimensions">维度详解</TabsTrigger>
          <TabsTrigger value="trend">剪刀差</TabsTrigger>
          <TabsTrigger value="rigidity">刚性分析</TabsTrigger>
        </TabsList>

        {/* Dimensions Detail Tab with Radar Chart */}
        <TabsContent value="dimensions" className="space-y-6 pt-4">
          {/* Radar Chart at the top */}
          <Card>
            <CardHeader>
              <CardTitle>财务健康雷达图</CardTitle>
              <CardDescription>5维度综合评估，直观展示财务"短板"（凹陷处）</CardDescription>
            </CardHeader>
            <CardContent>
              <FinancialHealthRadar data={healthResult} />
            </CardContent>
          </Card>

          {/* Dimension Cards with Scoring Rules */}
          {dimensions.map((dimension) => (
            <Card key={dimension.name}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-lg',
                      dimension.status === 'good' ? 'bg-primary/10' :
                      dimension.status === 'warning' ? 'bg-yellow-100' : 'bg-destructive/10'
                    )}>
                      <dimension.icon className={cn(
                        'h-5 w-5',
                        dimension.status === 'good' ? 'text-primary' :
                        dimension.status === 'warning' ? 'text-yellow-600' : 'text-destructive'
                      )} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{dimension.name}</CardTitle>
                      <CardDescription>{dimension.description}</CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{dimension.score}</div>
                    <div className="text-sm text-muted-foreground">/ {dimension.maxScore} 分</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div>
                  <Progress
                    value={(dimension.score / dimension.maxScore) * 100}
                    className="h-3"
                  />
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={
                    dimension.status === 'good' ? 'border-primary text-primary' :
                    dimension.status === 'warning' ? 'border-yellow-600 text-yellow-600' :
                    'border-destructive text-destructive'
                  }>
                    {dimension.status === 'good' ? '优秀' : dimension.status === 'warning' ? '一般' : '需改善'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{dimension.details}</span>
                </div>

                {/* Recommendation */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium text-sm mb-1">改善建议</div>
                      <p className="text-sm text-muted-foreground">{dimension.recommendation}</p>
                    </div>
                  </div>
                </div>

                {/* Settings Alert for Rigidity */}
                {dimension.settingsAlert && (
                  <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <Settings className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium text-sm mb-1 text-amber-900 dark:text-amber-100">需要设置</div>
                          <p className="text-sm text-amber-700 dark:text-amber-300">{dimension.settingsAlert.message}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-amber-300 dark:border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20"
                        onClick={dimension.settingsAlert.onAction}
                      >
                        {dimension.settingsAlert.actionLabel}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Scoring Rules */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm font-medium mb-2">📊 得分规则</div>
                  <div className="text-sm text-muted-foreground">
                    {dimension.scoringRules}
                  </div>
                </div>

                {/* Detailed Analysis */}
                <div>
                  <div className="text-sm font-medium mb-2">详细分析</div>
                  <ul className="space-y-1">
                    {dimension.analysis.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Scissors Trend Tab */}
        <TabsContent value="trend" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>剪刀差趋势分析</CardTitle>
              <CardDescription>
                收入vs支出线性回归趋势，阴影区域代表"财富积累区"
              </CardDescription>
            </CardHeader>
            <CardContent>
                <ScissorsTrendChart
                  monthlyData={safeMonthlyData}
                  regression={healthResult.monthlyRegression}
                />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rigidity Tab */}
        <TabsContent value="rigidity" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>支出刚性分析</CardTitle>
              <CardDescription>
                桑基图展示资金流向，识别"不得不花"的钱 vs "弹性可控"的钱
              </CardDescription>
            </CardHeader>
          <CardContent>
            <RigiditySankey transactions={transactions} totalIncome={safeTotalIncome} />
          </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
