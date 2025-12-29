import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataQualityMetrics, TransactionValidation } from '@/types/data';
import { useSettings, getIncomeColor, getExpenseColor } from '@/contexts/SettingsContext';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Calendar,
  Tag,
  Wallet,
  FileText,
  Copy,
  Filter,
  TrendingUp,
  TrendingDown,
  Layers
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface DataQualityProps {
  metrics: DataQualityMetrics | null;
  validations: TransactionValidation[] | null;
  onFilterChange?: (severity: string[]) => void;
}

export function DataQuality({ metrics, validations, onFilterChange }: DataQualityProps) {
  const { settings } = useSettings();
  const incomeColorClass = getIncomeColor(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);

  const overallScore = useMemo(() => {
    if (!metrics || metrics.totalRecords === 0) return 0;

    const completenessScore =
      (metrics.dateCompleteness +
        metrics.categoryCompleteness +
        metrics.amountCompleteness +
        metrics.accountCompleteness) / 4;

    const validityScore =
      ((metrics.totalRecords - metrics.criticalRecords - metrics.errorRecords) / metrics.totalRecords) * 100;

    return (completenessScore * 0.6 + validityScore * 0.4);
  }, [metrics]);

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 dark:text-green-400';
    if (percentage >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (percentage: number) => {
    if (percentage >= 90) return '数据质量优秀';
    if (percentage >= 70) return '数据质量良好';
    if (percentage >= 50) return '数据质量一般';
    return '数据质量较差';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'valid': return 'default';
      case 'warning': return 'secondary';
      case 'error': return 'destructive';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'valid': return '正常';
      case 'warning': return '警告';
      case 'error': return '错误';
      case 'critical': return '严重';
      default: return severity;
    }
  };

  if (!metrics || metrics.totalRecords === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>数据质量评估</CardTitle>
          <CardDescription>请先导入数据以查看质量评估</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            暂无数据，请先导入交易记录
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle>数据质量总评</CardTitle>
          <CardDescription>综合评估数据完整性和有效性</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className={`text-6xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore.toFixed(0)}%
            </div>
            <div className="flex-1 space-y-3">
              <Progress value={overallScore} className="h-3" />
              <p className={`text-lg font-medium ${getScoreColor(overallScore)}`}>
                {getScoreLabel(overallScore)}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  <Layers className="h-3 w-3" />
                  {metrics.totalRecords} 条记录
                </Badge>
                <Badge variant="outline" className="gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  {metrics.validRecords} 正常
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {metrics.warningRecords} 警告
                </Badge>
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {metrics.errorRecords + metrics.criticalRecords} 错误
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Completeness Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>数据完整性</CardTitle>
          <CardDescription>各字段的完整度评估</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <CompletenessBar
              name="日期完整性"
              percentage={metrics.dateCompleteness}
              icon={Calendar}
              issues={metrics.missingDates}
            />
            <CompletenessBar
              name="分类完整性"
              percentage={metrics.categoryCompleteness}
              icon={Tag}
            />
            <CompletenessBar
              name="金额有效性"
              percentage={metrics.amountCompleteness}
              icon={FileText}
              issues={metrics.zeroAmounts + metrics.negativeAmounts}
            />
            <CompletenessBar
              name="账户信息"
              percentage={metrics.accountCompleteness}
              icon={Wallet}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Integrity */}
      <Card>
        <CardHeader>
          <CardTitle>数据完整性检查</CardTitle>
          <CardDescription>检测异常数据问题</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <IntegrityCard
              label="无效日期"
              count={metrics.missingDates}
              total={metrics.totalRecords}
              type={metrics.missingDates > 0 ? 'error' : 'success'}
            />
            <IntegrityCard
              label="未来日期"
              count={metrics.futureDates}
              total={metrics.totalRecords}
              type={metrics.futureDates > 0 ? 'warning' : 'success'}
            />
            <IntegrityCard
              label="异常金额"
              count={metrics.zeroAmounts + metrics.negativeAmounts}
              total={metrics.totalRecords}
              type={metrics.zeroAmounts + metrics.negativeAmounts > 0 ? 'error' : 'success'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Category Mapping Warning */}
      {metrics.missingSecondaryMappings > 0 && (
        <Card className="border-orange-500/50 bg-orange-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              分类映射缺失
            </CardTitle>
            <CardDescription>部分三级分类未找到对应的二级分类映射</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">缺失映射的记录数：</span>
                <span className="font-semibold text-orange-700 dark:text-orange-400">
                  {metrics.missingSecondaryMappings} / {metrics.totalRecords}
                </span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">未映射的三级分类：</p>
                <div className="flex flex-wrap gap-2">
                  {metrics.unmappedTertiaryCategories.map((cat) => (
                    <Badge key={cat} variant="outline" className="text-xs border-orange-500/50 text-orange-700 dark:text-orange-400">
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                提示：请在"设置"→"分类映射"中查看完整的二级→三级分类关系，或添加缺失的映射
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Basic Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>基础统计</CardTitle>
          <CardDescription>数据概览信息</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">日期范围</p>
              <p className="text-lg font-semibold mt-1">
                {metrics.dateRange?.start} ~ {metrics.dateRange?.end}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">年份数</p>
              <p className="text-2xl font-bold">{metrics.years.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">月份数</p>
              <p className="text-2xl font-bold">{metrics.months.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">账户数</p>
              <p className="text-2xl font-bold">{metrics.accounts.length}</p>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">收入笔数</p>
              <p className={`text-2xl font-bold ${incomeColorClass}`}>{metrics.incomeCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">支出笔数</p>
              <p className={`text-2xl font-bold ${expenseColorClass}`}>{metrics.expenseCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">总收入</p>
              <p className={`text-xl font-bold ${incomeColorClass}`}>
                ¥{metrics.totalIncome.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">总支出</p>
              <p className={`text-xl font-bold ${expenseColorClass}`}>
                ¥{metrics.totalExpense.toLocaleString()}
              </p>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                资金账户 ({metrics.accounts.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {metrics.accounts.map(acc => (
                  <Badge key={acc} variant="secondary">{acc}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                一级分类 ({metrics.primaryCategories.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {metrics.primaryCategories.map(cat => (
                  <Badge key={cat} variant="outline">{cat}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Details */}
      {validations && validations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>校验详情</CardTitle>
            <CardDescription>仅显示有异常的记录（共 {validations.filter(v => v.severity !== 'valid').length} 条）</CardDescription>
          </CardHeader>
          <CardContent>
            {validations.filter(v => v.severity !== 'valid').length === 0 ? (
              <div className="text-center py-8 text-green-600 dark:text-green-400">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>所有数据校验通过，无异常记录</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {validations
                    .filter(v => v.severity !== 'valid')
                    .slice(0, 100)
                    .map((v, idx) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(v.severity) as any}>
                            {getSeverityLabel(v.severity)}
                          </Badge>
                          <span className="text-sm font-medium">
                            {v.transaction.date}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {v.transaction.primaryCategory} / {v.transaction.secondaryCategory}
                          </span>
                        </div>
                        <span className={`text-sm font-semibold ${v.transaction.type === 'income' ? incomeColorClass : expenseColorClass}`}>
                              {v.transaction.type === 'income' ? '+' : '-'}¥{v.transaction.amount.toFixed(2)}
                            </span>
                      </div>
                      {(v.errors.length > 0 || v.warnings.length > 0) && (
                        <div className="text-xs space-y-1">
                          {v.errors.map((err, i) => (
                            <p key={i} className="text-red-600">• {err}</p>
                          ))}
                          {v.warnings.map((warn, i) => (
                            <p key={i} className="text-yellow-600">• {warn}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CompletenessBar({
  name,
  percentage,
  icon: Icon,
  issues
}: {
  name: string;
  percentage: number;
  icon: any;
  issues?: number;
}) {
  const getColor = (p: number) => {
    if (p >= 95) return 'bg-green-500';
    if (p >= 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{name}</span>
          {issues !== undefined && issues > 0 && (
            <Badge variant="destructive" className="text-xs">{issues} 问题</Badge>
          )}
        </div>
        <span className="text-sm font-semibold">{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor(percentage)} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function IntegrityCard({
  label,
  count,
  total,
  type
}: {
  label: string;
  count: number;
  total: number;
  type: 'success' | 'warning' | 'error';
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  const colors = {
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600'
  };

  return (
    <div className="p-4 border rounded-lg">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${colors[type]}`}>
        {count}
        <span className="text-sm text-muted-foreground font-normal">
          ({percentage.toFixed(1)}%)
        </span>
      </p>
    </div>
  );
}
