import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useMcpSettingsViewModel } from '../../src/viewmodels/settings/useMcpSettingsViewModel';

const mockUpdateMcpEnabled = vi.fn();

vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      mcpEnabled: false,
    },
    updateMcpEnabled: mockUpdateMcpEnabled,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    session: {
      refresh_token: 'mock-refresh-token-abc',
    },
  }),
}));

describe('useMcpSettingsViewModel', () => {
  const mockRefreshSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshSession.mockResolvedValue({
      data: {
        session: { refresh_token: 'new-refresh-token-xyz' },
      },
      error: null,
    });
  });

  it('exposes mcpEnabled from settings', () => {
    const { result } = renderHook(() => useMcpSettingsViewModel(mockRefreshSession));
    expect(result.current.mcpEnabled).toBe(false);
  });

  it('delegates toggle to updateMcpEnabled', () => {
    const { result } = renderHook(() => useMcpSettingsViewModel(mockRefreshSession));

    act(() => {
      result.current.toggleMcp(true);
    });

    expect(mockUpdateMcpEnabled).toHaveBeenCalledWith(true);
  });

  it('exposes refresh token from session', () => {
    const { result } = renderHook(() => useMcpSettingsViewModel(mockRefreshSession));
    expect(result.current.refreshToken).toBe('mock-refresh-token-abc');
  });

  it('refreshes session and updates refresh token', async () => {
    const { result } = renderHook(() => useMcpSettingsViewModel(mockRefreshSession));

    await act(async () => {
      await result.current.handleRefreshToken();
    });

    expect(mockRefreshSession).toHaveBeenCalled();
    expect(result.current.refreshToken).toBe('new-refresh-token-xyz');
  });

  it('handles refresh error gracefully', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'refresh failed' },
    });

    const { result } = renderHook(() => useMcpSettingsViewModel(mockRefreshSession));

    await act(async () => {
      await result.current.handleRefreshToken();
    });

    // Should keep original token on error
    expect(result.current.refreshToken).toBe('mock-refresh-token-abc');
    expect(result.current.refreshError).toBe('refresh failed');
  });

  it('generates config JSON string', () => {
    const { result } = renderHook(() => useMcpSettingsViewModel(mockRefreshSession));
    const config = result.current.configJson;

    expect(config).toContain('mcpServers');
    expect(config).toContain('noheir');
    expect(config).toContain('mock-refresh-token-abc');
  });
});
