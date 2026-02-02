import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useAIInsightViewModel } from '../../src/viewmodels/dashboard/useAIInsightViewModel';

vi.mock('../../src/services/insightService', () => ({
  RecurringPaymentDetector: {
    detectRecurringPayments: () => [],
    generateInsights: () => [],
  },
}));

describe('useAIInsightViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates insight when data available', () => {
    const { result } = renderHook(() => useAIInsightViewModel({
      allTransactions: [{
        id: '1',
        date: '2024-01-01',
        year: 2024,
        month: 1,
        primaryCategory: 'A',
        secondaryCategory: 'A',
        tertiaryCategory: 'A',
        amount: 10,
        account: 'A',
        type: 'expense',
      }],
      isLoading: false,
    }));

    act(() => {
      result.current.generateInsights();
    });

    expect(result.current.aiInsight).toBeTruthy();
  });
});
