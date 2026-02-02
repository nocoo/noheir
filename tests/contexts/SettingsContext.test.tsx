import { describe, expect, it, mock, vi } from 'bun:test';
import React from 'react';
import { renderHook, act } from '@testing-library/react';

const mockGetSession = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

describe('SettingsContext', () => {
  const setup = async () => {
    vi.clearAllMocks();
    localStorage.clear();

    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });

    mock.module('../../src/lib/supabase', () => ({
      supabase: {
        auth: {
          getSession: mockGetSession,
        },
        from: mockFrom,
      },
    }));

    return await import(`../../src/contexts/SettingsContext?test=${Date.now()}`);
  };

  it('updates settings and persists to localStorage', async () => {
    const { SettingsProvider, useSettings } = await setup();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );

    const { result } = renderHook(() => useSettings(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.updateTheme('dark');
    });

    expect(result.current.settings.theme).toBe('dark');
    expect(localStorage.getItem('finance-settings')).toContain('"theme":"dark"');
  });

  it('syncs settings from supabase session', async () => {
    const { SettingsProvider, useSettings } = await setup();
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockMaybeSingle.mockResolvedValue({
      data: {
        site_name: 'Synced',
        settings: { targetSavingsRate: 55 },
      },
      error: null,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );

    const { result } = renderHook(() => useSettings(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.settings.siteName).toBe('Synced');
    expect(result.current.settings.targetSavingsRate).toBe(55);
  });
});
