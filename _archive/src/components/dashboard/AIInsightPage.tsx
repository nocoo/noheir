import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  Calendar, 
  DollarSign, 
  AlertTriangle, 
  TrendingUp,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyFull } from '@/lib/chart-config';
import { useTransactions } from '@/hooks/useTransactions';
import { motion } from 'framer-motion';
import { fadeInUp, staggerItem } from '@/lib/animations';
import { useAIInsightViewModel } from '@/viewmodels/dashboard/useAIInsightViewModel';

const AIInsightPage = () => {
  const { allTransactions, isLoading } = useTransactions();
  const {
    aiInsight,
    isGenerating,
    lastGenerated,
    sortedInsights,
    sortedRecurringPayments,
    generateInsights,
  } = useAIInsightViewModel({ allTransactions, isLoading });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'recurring_payment': return <AlertTriangle className="h-4 w-4" />;
      case 'upcoming_renewal': return <Calendar className="h-4 w-4" />;
      case 'budget_alert': return <TrendingUp className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const frequencyLabels = {
    monthly: '每月',
    quarterly: '每季度',
    yearly: '每年',
    weekly: '每周',
    biweekly: '每两周'
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">加载财务数据...</span>
      </div>
    );
  }

  if (!allTransactions || allTransactions.length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            没有找到财务数据。请先导入交易记录才能生成AI洞察。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {aiInsight && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Brain className="h-6 w-6 text-blue-600" />
                AI 财务洞察
              </h2>
              <p className="text-muted-foreground text-sm">
                基于你的财务数据自动分析，发现周期性支出和即将到期的付款
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lastGenerated && (
                <span className="text-sm text-muted-foreground">
                  最后生成: {lastGenerated}
                </span>
              )}
              <Button 
                onClick={generateInsights} 
                disabled={isGenerating}
                variant="outline"
                size="sm"
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                重新分析
              </Button>
            </div>
          </div>

          <Alert>
            <Brain className="h-4 w-4" />
            <AlertDescription>
              {aiInsight.summary}
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  周期性付款 ({aiInsight.recurringPayments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {sortedRecurringPayments.map((payment, index) => (
                      <motion.div
                        key={payment.id}
                        initial="initial"
                        animate="animate"
                        variants={staggerItem}
                        transition={{ delay: index * 0.1 }}
                        className="border rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{payment.description}</h4>
                              <Badge variant="secondary">
                                {frequencyLabels[payment.frequency]}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              账户: {payment.account} | 
                              平均: {formatCurrencyFull(payment.amount)} |
                              共{payment.occurrences}次
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="text-sm">
                              <span className="text-muted-foreground">下次付款: </span>
                              <span className="font-medium">{payment.nextPaymentDate}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              平均间隔: {payment.averageInterval}天
                            </div>
                          </div>
                        </div>
                        <Separator className="my-3" />
                        <div className="text-sm space-y-1">
                            <div>年度总计: {formatCurrencyFull(payment.yearlyTotal)}</div>
                            <div>月度估算: {formatCurrencyFull(payment.yearlyTotal / 12)}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  智能提醒 ({sortedInsights.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {sortedInsights.map((insight, index) => (
                      <motion.div
                        key={insight.type + index}
                        initial="initial"
                        animate="animate"
                        variants={staggerItem}
                        transition={{ delay: index * 0.1 }}
                        className="border rounded-lg p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full mt-2",
                            getPriorityColor(insight.priority)
                          )} />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold flex items-center gap-2">
                                {getInsightIcon(insight.type)}
                                {insight.title}
                              </h4>
                              <Badge 
                                variant={insight.priority === 'high' ? 'destructive' : 'secondary'}
                              >
                                {insight.priority === 'high' ? '紧急' : insight.priority === 'medium' ? '提醒' : '建议'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {insight.description}
                            </p>
                            <p className="text-sm font-medium text-blue-600">
                              💡 {insight.recommendation}
                            </p>
                            {insight.dueDate && (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4" />
                                <span>到期时间: {insight.dueDate}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {insight.amount && (
                          <div className="text-lg font-bold text-right">
                            {formatCurrencyFull(insight.amount)}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>数据范围</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">开始日期:</span>
                  <div className="font-medium">{aiInsight.dataRange.startDate}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">结束日期:</span>
                  <div className="font-medium">{aiInsight.dataRange.endDate}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">交易记录:</span>
                  <div className="font-medium">{aiInsight.dataRange.transactionCount}笔</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default AIInsightPage;
