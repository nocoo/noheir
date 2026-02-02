import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useSiteNameViewModel } from '../../src/viewmodels/settings/useSiteNameViewModel';

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: '1' } }),
}));

const mockCreateMetadata = vi.fn();
const mockUpdateSiteName = vi.fn();
vi.mock('../../src/hooks/useSupabaseSettings', () => ({
  useSupabaseSettings: () => ({
    data: null,
    loading: false,
    error: null,
    createMetadata: mockCreateMetadata,
    updateSiteName: mockUpdateSiteName,
  }),
}));

describe('useSiteNameViewModel', () => {
  const toast = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-creates metadata for new users', () => {
    renderHook(() => useSiteNameViewModel(toast));
    expect(mockCreateMetadata).toHaveBeenCalled();
  });
});
