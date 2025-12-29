import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Transaction } from '@/types/transaction';
import { CheckCircle, AlertTriangle, XCircle, Calendar, Tag, Wallet, FileText } from 'lucide-react';

interface DataQualityProps {
  transactions: Transaction[];
}

interface QualityMetric {
  name: string;
  score: number;
  total: number;
  issues: string[];
  icon: typeof CheckCircle;
}

export function DataQuality({ transactions }: DataQualityProps) {
  const metrics = useMemo(() => {
    const result: QualityMetric[] = [];
    
    // Date completeness
    const validDates = transactions.filter(t => t.date && !isNaN(new Date(t.date).getTime()));
    const dateIssues = transactions.length - validDates.length;
    result.push({
      name: '日期完整性',
      score: validDates.length,
      total: transactions.length,
      issues: dateIssues > 0 ? [`${dateIssues} 条记录日期无效`] : [],
      icon: Calendar
    });

    // Category completeness
    const validPrimary = transactions.filter(t => t.primaryCategory && t.primaryCategory.trim() !== '');
    const validSecondary = transactions.filter(t => t.secondaryCategory && t.secondaryCategory.trim() !== '');
    const categoryIssues: string[] = [];
    if (transactions.length - validPrimary.length > 0) {
      categoryIssues.push(`${transactions.length - validPrimary.length} 条记录缺少一级分类`);
    }
    if (transactions.length - validSecondary.length > 0) {
      categoryIssues.push(`${transactions.length - validSecondary.length} 条记录缺少二级分类`);
    }
    result.push({
      name: '分类完整性',
      score: Math.min(validPrimary.length, validSecondary.length),
      total: transactions.length,
      issues: categoryIssues,
      icon: Tag
    });

    // Account completeness
    const validAccount = transactions.filter(t => t.account && t.account.trim() !== '');
    const accountIssues = transactions.length - validAccount.length;
    result.push({
      name: '账户信息',
      score: validAccount.length,
      total: transactions.length,
      issues: accountIssues > 0 ? [`${accountIssues} 条记录缺少账户信息`] : [],
      icon: Wallet
    });

    // Amount validity
    const validAmount = transactions.filter(t => t.amount > 0);
    const amountIssues = transactions.length - validAmount.length;
    result.push({
      name: '金额有效性',
      score: validAmount.length,
      total: transactions.length,
      issues: amountIssues > 0 ? [`${amountIssues} 条记录金额无效`] : [],
      icon: FileText
    });

    return result;
  }, [transactions]);

  const overallScore = useMemo(() => {
    if (transactions.length === 0) return 0;
    const totalScore = metrics.reduce((sum, m) => sum + (m.score / m.total), 0);
    return (totalScore / metrics.length) * 100;
  }, [metrics, transactions.length]);

  const statistics = useMemo(() => {
    if (transactions.length === 0) return null;

    const years = [...new Set(transactions.map(t => t.year))].sort();
    const months = [...new Set(transactions.map(t => `${t.year}-${t.month}`))].length;
    const accounts = [...new Set(transactions.map(t => t.account))];
    const primaryCategories = [...new Set(transactions.map(t => t.primaryCategory))];
    const secondaryCategories = [...new Set(transactions.map(t => t.secondaryCategory))];
    
    const incomeCount = transactions.filter(t => t.type === 'income').length;
    const expenseCount = transactions.filter(t => t.type === 'expense').length;
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    return {
      years,
      months,
      accounts,
      primaryCategories,
      secondaryCategories,
      incomeCount,
      expenseCount,
      totalIncome,
      totalExpense,
      dateRange: transactions.length > 0 ? {
        start: transactions.reduce((min, t) => t.date < min ? t.date : min, transactions[0].date),
        end: transactions.reduce((max, t) => t.date > max ? t.date : max, transactions[0].date)
      } : null
    };
  }, [transactions]);

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 dark:text-green-400';
    if (percentage >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreIcon = (percentage: number) => {
    if (percentage >= 90) return CheckCircle;
    if (percentage >= 70) return AlertTriangle;
    return XCircle;
  };

  if (transactions.length === 0) {
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
            <div className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore.toFixed(0)}%
            </div>
            <div className="flex-1">
              <Progress value={overallScore} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {overallScore >= 90 ? '数据质量优秀' : 
                 overallScore >= 70 ? '数据质量良好，部分需要完善' : 
                 '数据质量需要改进'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map(metric => {
          const percentage = metric.total > 0 ? (metric.score / metric.total) * 100 : 0;
          const ScoreIcon = getScoreIcon(percentage);
          
          return (
            <Card key={metric.name}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg bg-muted`}>
                    <metric.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{metric.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${getScoreColor(percentage)}`}>
                          {metric.score}/{metric.total}
                        </span>
                        <ScoreIcon className={`h-4 w-4 ${getScoreColor(percentage)}`} />
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2" />
                    {metric.issues.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {metric.issues.map((issue, i) => (
                          <p key={i} className="text-xs text-muted-foreground">{issue}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Basic Statistics */}
      {statistics && (
        <Card>
          <CardHeader>
            <CardTitle>基础统计</CardTitle>
            <CardDescription>数据概览信息</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">交易总数</p>
                <p className="text-2xl font-bold">{transactions.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">日期范围</p>
                <p className="text-lg font-semibold">
                  {statistics.dateRange?.start} ~ {statistics.dateRange?.end}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">年份数</p>
                <p className="text-2xl font-bold">{statistics.years.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">月份数</p>
                <p className="text-2xl font-bold">{statistics.months}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-border">
              <div>
                <p className="text-sm text-muted-foreground">收入笔数</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{statistics.incomeCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">支出笔数</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{statistics.expenseCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总收入</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  ¥{statistics.totalIncome.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总支出</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">
                  ¥{statistics.totalExpense.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">账户 ({statistics.accounts.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {statistics.accounts.map(acc => (
                      <Badge key={acc} variant="secondary">{acc}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">一级分类 ({statistics.primaryCategories.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {statistics.primaryCategories.map(cat => (
                      <Badge key={cat} variant="outline">{cat}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">二级分类 ({statistics.secondaryCategories.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {statistics.secondaryCategories.slice(0, 10).map(cat => (
                      <Badge key={cat} variant="outline">{cat}</Badge>
                    ))}
                    {statistics.secondaryCategories.length > 10 && (
                      <Badge variant="outline">+{statistics.secondaryCategories.length - 10}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
