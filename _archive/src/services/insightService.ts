import { Transaction } from '@/types/transaction';
import { RecurringPayment, PeriodicityPattern, PaymentInsight } from '@/types/insight';
import { format, parseISO, differenceInDays, startOfMonth, addMonths, addWeeks, addQuarters, addYears } from 'date-fns';

export class RecurringPaymentDetector {
  
  static detectRecurringPayments(transactions: Transaction[]): RecurringPayment[] {
    const categoryGroups = this.groupTransactions(transactions);
    const recurringPayments: RecurringPayment[] = [];

    for (const [key, group] of Object.entries(categoryGroups)) {
      if (group.length < 3) continue;

      const patterns = this.analyzePeriodicity(group);
      for (const pattern of patterns) {
        if (pattern.consistency === 'high' || pattern.consistency === 'medium') {
          const recurringPayment = this.createRecurringPayment(pattern, group);
          if (recurringPayment) {
            recurringPayments.push(recurringPayment);
          }
        }
      }
    }

    return this.deduplicatePayments(recurringPayments);
  }

  private static groupTransactions(transactions: Transaction[]): Record<string, Transaction[]> {
    const groups: Record<string, Transaction[]> = {};
    
    transactions.forEach(transaction => {
      const key = `${transaction.primaryCategory}-${transaction.tertiaryCategory}-${transaction.account}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(transaction);
    });

    return groups;
  }

  private static analyzePeriodicity(transactions: Transaction[]): PeriodicityPattern[] {
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const intervals: number[] = [];
    
    for (let i = 1; i < sorted.length; i++) {
      const daysDiff = differenceInDays(new Date(sorted[i].date), new Date(sorted[i - 1].date));
      if (daysDiff > 0 && daysDiff <= 400) {
        intervals.push(daysDiff);
      }
    }

    if (intervals.length < 2) return [];

    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - averageInterval, 2), 0) / intervals.length;
    const standardDeviation = Math.sqrt(variance);
    
    const consistency = this.calculateConsistency(standardDeviation, averageInterval);
    const frequency = this.inferFrequency(averageInterval);
    const lastPayment = sorted[sorted.length - 1];
    const predictedNext = this.predictNextPayment(lastPayment.date, frequency);

    return [{
      category: sorted[0].primaryCategory,
      description: sorted[0].tertiaryCategory,
      account: sorted[0].account,
      intervals,
      averageInterval,
      standardDeviation,
      consistency,
      lastPaymentDate: lastPayment.date,
      predictedNextDate: predictedNext,
      monthlyAmount: this.calculateMonthlyAmount(sorted, averageInterval),
      yearlyTotal: this.calculateYearlyTotal(sorted, averageInterval)
    }];
  }

  private static calculateConsistency(stdDev: number, mean: number): 'high' | 'medium' | 'low' {
    const coefficient = stdDev / mean;
    if (coefficient <= 0.1) return 'high';
    if (coefficient <= 0.25) return 'medium';
    return 'low';
  }

  private static inferFrequency(averageDays: number): 'monthly' | 'quarterly' | 'yearly' | 'weekly' | 'biweekly' {
    if (Math.abs(averageDays - 7) <= 3) return 'weekly';
    if (Math.abs(averageDays - 14) <= 4) return 'biweekly';
    if (Math.abs(averageDays - 30) <= 5) return 'monthly';
    if (Math.abs(averageDays - 90) <= 10) return 'quarterly';
    if (Math.abs(averageDays - 365) <= 30) return 'yearly';
    return 'monthly';
  }

  private static predictNextPayment(lastDate: string, frequency: string): string {
    const date = parseISO(lastDate);
    switch (frequency) {
      case 'weekly':
        return format(addWeeks(date, 1), 'yyyy-MM-dd');
      case 'biweekly':
        return format(addWeeks(date, 2), 'yyyy-MM-dd');
      case 'monthly':
        return format(addMonths(date, 1), 'yyyy-MM-dd');
      case 'quarterly':
        return format(addQuarters(date, 1), 'yyyy-MM-dd');
      case 'yearly':
        return format(addYears(date, 1), 'yyyy-MM-dd');
      default:
        return format(addMonths(date, 1), 'yyyy-MM-dd');
    }
  }

  private static calculateMonthlyAmount(transactions: Transaction[], averageDays: number): number {
    if (averageDays <= 7) {
      return transactions.reduce((sum, t) => sum + t.amount, 0) * 4.33;
    } else if (averageDays <= 14) {
      return transactions.reduce((sum, t) => sum + t.amount, 0) * 2.17;
    } else if (averageDays <= 90) {
      return transactions.reduce((sum, t) => sum + t.amount, 0) / (averageDays / 30);
    } else {
      return transactions.reduce((sum, t) => sum + t.amount, 0) / 12;
    }
  }

  private static calculateYearlyTotal(transactions: Transaction[], averageDays: number): number {
    if (averageDays <= 7) {
      return transactions.reduce((sum, t) => sum + t.amount, 0) * 52;
    } else if (averageDays <= 14) {
      return transactions.reduce((sum, t) => sum + t.amount, 0) * 26;
    } else if (averageDays <= 90) {
      return transactions.reduce((sum, t) => sum + t.amount, 0) * (365 / averageDays);
    } else {
      return transactions.reduce((sum, t) => sum + t.amount, 0);
    }
  }

  private static createRecurringPayment(pattern: PeriodicityPattern, transactions: Transaction[]): RecurringPayment | null {
    const recentTransactions = transactions.slice(-3);
    const yearlyTotal = this.calculateYearlyTotal(transactions, pattern.averageInterval);
    
    return {
      id: `${pattern.account}-${pattern.description}`,
      description: pattern.description,
      account: pattern.account,
      amount: recentTransactions.reduce((sum, t) => sum + t.amount, 0) / recentTransactions.length,
      frequency: this.inferFrequency(pattern.averageInterval),
      nextPaymentDate: pattern.predictedNextDate,
      averageInterval: Math.round(pattern.averageInterval),
      occurrences: transactions.length,
      totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
      yearlyTotal,
      category: pattern.category,
      recentTransactions: recentTransactions.map(t => ({
        date: t.date,
        amount: t.amount,
        description: t.tertiaryCategory
      }))
    };
  }

  private static deduplicatePayments(payments: RecurringPayment[]): RecurringPayment[] {
    const seen = new Set<string>();
    return payments.filter(payment => {
      const key = `${payment.account}-${payment.description}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  static generateInsights(recurringPayments: RecurringPayment[], currentDate: string = new Date().toISOString()): PaymentInsight[] {
    const insights: PaymentInsight[] = [];
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    recurringPayments.forEach(payment => {
      const nextPaymentDate = new Date(payment.nextPaymentDate);
      const daysUntilNext = differenceInDays(nextPaymentDate, today);

      if (daysUntilNext <= 0 && daysUntilNext >= -7) {
        insights.push({
          type: 'recurring_payment',
          priority: 'high',
          title: `需要支付：${payment.description}`,
          description: `${payment.account}的${payment.description}费用已到期或即将到期`,
          amount: payment.amount,
          dueDate: payment.nextPaymentDate,
          recommendation: `建议立即处理${payment.description}的支付，避免逾期`,
          confidence: 0.9
        });
      } else if (daysUntilNext <= 7 && daysUntilNext > 0) {
        insights.push({
          type: 'upcoming_renewal',
          priority: 'medium',
          title: `即将到期：${payment.description}`,
          description: `${payment.account}的${payment.description}将在${daysUntilNext}天后到期`,
          amount: payment.amount,
          dueDate: payment.nextPaymentDate,
          recommendation: `准备资金用于${daysUntilNext}天后的${payment.description}续费`,
          confidence: 0.8
        });
      }

      if (payment.yearlyTotal > 12000 && payment.frequency === 'monthly') {
        insights.push({
          type: 'budget_alert',
          priority: 'medium',
          title: `高额月度支出：${payment.description}`,
          description: `${payment.description}年度总支出达${payment.yearlyTotal.toLocaleString()}元，占总支出比例较高`,
          amount: payment.yearlyTotal / 12,
          recommendation: '考虑是否有更经济的替代方案或优化使用方式',
          confidence: 0.7
        });
      }
    });

    return insights.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}