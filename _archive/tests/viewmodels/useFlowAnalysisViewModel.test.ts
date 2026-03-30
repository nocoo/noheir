import { describe, expect, it } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useFlowAnalysisViewModel } from '../../src/viewmodels/dashboard/useFlowAnalysisViewModel';

describe('useFlowAnalysisViewModel', () => {
  it('returns tabs and title', () => {
    const { result } = renderHook(() => useFlowAnalysisViewModel({
      transactions: [],
      selectedYear: 2024,
      availableYears: [2024],
      onYearChange: () => undefined,
    }));
    expect(result.current.tabs.length).toBe(2);
    expect(result.current.title.title).toBe('流向分析');
  });
});
