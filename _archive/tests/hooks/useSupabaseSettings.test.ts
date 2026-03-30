import { describe, expect, it, mock, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockEqAfterUpdate = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSingle = vi.fn();
const mockSelectAfterInsert = vi.fn();
const mockSelectAfterUpdate = vi.fn();

const mockUser = { id: 'user-1' };

describe('useSupabaseSettings', () => {
  const setup = async () => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    });

    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle, select: mockSelect, single: mockSingle });
    mockEqAfterUpdate.mockReturnValue({ select: mockSelectAfterUpdate });
    mockSelectAfterInsert.mockReturnValue({ single: mockSingle });
    mockSelectAfterUpdate.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelectAfterInsert });
    mockUpdate.mockReturnValue({ eq: mockEqAfterUpdate });

    mock.module('../../src/contexts/AuthContext', () => ({
      useAuth: () => ({ user: mockUser }),
    }));

    mock.module('../../src/lib/supabase', () => ({
      supabase: {
        auth: {
          getSession: mockGetSession,
          onAuthStateChange: mockOnAuthStateChange,
        },
        from: mockFrom,
      },
    }));

    return await import(`../../src/hooks/useSupabaseSettings?test=${Date.now()}`);
  };

  it('loads metadata when user exists', async () => {
    const { useSupabaseSettings } = await setup();
    mockMaybeSingle.mockResolvedValue({ data: { id: 1, owner_id: mockUser.id, site_name: 'demo', settings: {} }, error: null });

    const { result } = renderHook(() => useSupabaseSettings());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data?.site_name).toBe('demo');
  });

  it('creates metadata via insert', async () => {
    const { useSupabaseSettings } = await setup();
    mockSingle.mockResolvedValue({ data: { id: 1, owner_id: mockUser.id, site_name: 'new', settings: {} }, error: null });

    const { result } = renderHook(() => useSupabaseSettings());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.createMetadata('new');
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(result.current.data?.site_name).toBe('new');
  });

  it('updates site name', async () => {
    const { useSupabaseSettings } = await setup();
    mockSingle.mockResolvedValue({ data: { id: 1, owner_id: mockUser.id, site_name: 'updated', settings: {} }, error: null });

    const { result } = renderHook(() => useSupabaseSettings());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.updateSiteName('updated');
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(result.current.data?.site_name).toBe('updated');
  });

  it('updates a single setting', async () => {
    const { useSupabaseSettings } = await setup();
    mockMaybeSingle.mockResolvedValue({ data: { id: 1, owner_id: mockUser.id, site_name: 'demo', settings: { targetSavingsRate: 60 } }, error: null });
    mockSingle.mockResolvedValue({ data: { id: 1, owner_id: mockUser.id, site_name: 'demo', settings: { targetSavingsRate: 70 } }, error: null });

    const { result } = renderHook(() => useSupabaseSettings());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.updateSingleSetting('targetSavingsRate', 70);
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(result.current.data?.settings?.targetSavingsRate).toBe(70);
  });
});
