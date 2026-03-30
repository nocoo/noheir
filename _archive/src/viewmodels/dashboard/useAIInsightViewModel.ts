import { useState, useEffect, useMemo, useCallback } from 'react';
import { RecurringPaymentDetector } from '@/services/insightService';
import { formatCurrencyFull } from '@/lib/chart-config';
import type { AIInsight } from '@/types/insight';
import type { Transaction } from '@/types/transaction';
import {
  buildInsightSummaryData,
  sortInsightsByPriority,
  sortRecurringPaymentsByNextDate,
} from '@/domain/dashboard/aiInsight';

interface AIInsightViewModelParams {
  allTransactions: Transaction[];
  isLoading: boolean;
}

export function useAIInsightViewModel({ allTransactions, isLoading }: AIInsightViewModelParams) {
  const [aiInsight, setAIInsight] = useState<AIInsight | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string>('');
  const dataSignature = useMemo(() => {
    if (!allTransactions || allTransactions.length === 0) return '';
    const startDate = allTransactions[allTransactions.length - 1].date;
    const endDate = allTransactions[0].date;
    return `${allTransactions.length}-${startDate}-${endDate}`;
  }, [allTransactions]);

  const generateInsights = useCallback(async () => {
    if (!allTransactions || allTransactions.length === 0) return;

    setIsGenerating(true);

    try {
      const recurringPayments = RecurringPaymentDetector.detectRecurringPayments(allTransactions);
      const insights = RecurringPaymentDetector.generateInsights(recurringPayments);

      const summaryData = buildInsightSummaryData(recurringPayments, insights);
      const summary = `发现${summaryData.paymentsCount}个周期性付款，月度总计${formatCurrencyFull(summaryData.monthlyTotal)}，年度总计${formatCurrencyFull(summaryData.yearlyTotal)}，${summaryData.highPriorityCount}项需要立即关注。`;

      const newInsight: AIInsight = {
        id: `insight-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        insights,
        recurringPayments,
        summary,
        dataRange: {
          startDate: allTransactions[allTransactions.length - 1].date,
          endDate: allTransactions[0].date,
          transactionCount: allTransactions.length,
        },
      };

      setAIInsight(newInsight);
      setLastGenerated(new Date().toLocaleString());
    } catch (error) {
      console.error('生成AI洞察失败:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [allTransactions]);

  const sortedInsights = useMemo(() => {
    if (!aiInsight) return [];
    return sortInsightsByPriority(aiInsight.insights);
  }, [aiInsight]);

  const sortedRecurringPayments = useMemo(() => {
    if (!aiInsight) return [];
    return sortRecurringPaymentsByNextDate(aiInsight.recurringPayments);
  }, [aiInsight]);

  useEffect(() => {
    if (isLoading) return;
    if (!allTransactions || allTransactions.length === 0) return;

    if (aiInsight && dataSignature) {
      const currentSignature = `${aiInsight.dataRange.transactionCount}-${aiInsight.dataRange.startDate}-${aiInsight.dataRange.endDate}`;
      if (currentSignature === dataSignature) {
        return;
      }
    }

    generateInsights();
  }, [aiInsight, dataSignature, generateInsights, isLoading, allTransactions]);

  return {
    aiInsight,
    isGenerating,
    lastGenerated,
    sortedInsights,
    sortedRecurringPayments,
    generateInsights,
  };
}
