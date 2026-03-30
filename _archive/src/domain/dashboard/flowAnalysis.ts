import type { Transaction } from '@/types/transaction';

export const buildFlowTabs = () => ([
  { value: 'income', label: '收入流向' },
  { value: 'expense', label: '支出流向' },
]);

export const buildFlowTitle = () => ({
  title: '流向分析',
  description: '可视化资金从来源到分类的流向分布',
});

export const buildFlowTransactions = (transactions: Transaction[]) => transactions;
