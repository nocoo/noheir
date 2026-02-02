import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useDataManagementViewModel } from '../../src/viewmodels/dataManagement/useDataManagementViewModel';

const mockDeleteYearTransfers = vi.fn();
const mockClearAllTransfers = vi.fn();

vi.mock('../../src/hooks/useTransfers', () => ({
  useTransfers: () => ({
    storedYearsData: [],
    isLoading: false,
    deleteYearTransfers: mockDeleteYearTransfers,
    clearAllTransfers: mockClearAllTransfers,
  }),
}));

describe('useDataManagementViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears all data and transfers', () => {
    const onClearAll = vi.fn();
    const { result } = renderHook(() => useDataManagementViewModel({
      storedYearsData: [],
      isLoading: false,
      onDeleteYear: vi.fn(),
      onClearAll,
      onExport: vi.fn(),
      onGoToImport: vi.fn(),
      onViewQuality: vi.fn(),
      qualityData: null,
    }));

    act(() => {
      result.current.handleClearAllConfirm();
    });

    expect(onClearAll).toHaveBeenCalled();
    expect(mockClearAllTransfers).toHaveBeenCalled();
  });

  it('deletes transfer year when selected', () => {
    const onDeleteYear = vi.fn();
    const { result } = renderHook(() => useDataManagementViewModel({
      storedYearsData: [],
      isLoading: false,
      onDeleteYear,
      onClearAll: vi.fn(),
      onExport: vi.fn(),
      onGoToImport: vi.fn(),
      onViewQuality: vi.fn(),
      qualityData: null,
    }));

    act(() => {
      result.current.handleDeleteYearClick(2024, 'transfers');
    });

    act(() => {
      result.current.handleDeleteYearConfirm();
    });

    expect(mockDeleteYearTransfers).toHaveBeenCalledWith(2024);
    expect(onDeleteYear).not.toHaveBeenCalled();
  });
});
