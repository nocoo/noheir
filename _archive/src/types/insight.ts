export interface RecurringPayment {
  id: string;
  description: string;
  account: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'weekly' | 'biweekly';
  nextPaymentDate: string;
  averageInterval: number;
  occurrences: number;
  totalAmount: number;
  category: string;
  yearlyTotal: number;
  recentTransactions: Array<{
    date: string;
    amount: number;
    description: string;
  }>;
}

export interface PaymentInsight {
  type: 'recurring_payment' | 'upcoming_renewal' | 'irregular_payment' | 'budget_alert';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  amount?: number;
  dueDate?: string;
  recommendation: string;
  confidence: number;
}

export interface AIInsight {
  id: string;
  generatedAt: string;
  insights: PaymentInsight[];
  recurringPayments: RecurringPayment[];
  summary: string;
  dataRange: {
    startDate: string;
    endDate: string;
    transactionCount: number;
  };
}

export interface PeriodicityPattern {
  category: string;
  description: string;
  account: string;
  intervals: number[];
  averageInterval: number;
  standardDeviation: number;
  consistency: 'high' | 'medium' | 'low';
  lastPaymentDate: string;
  predictedNextDate: string;
  monthlyAmount: number;
  yearlyTotal: number;
}