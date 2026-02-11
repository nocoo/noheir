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
    user: {
      email: 'test@example.com',
    },
  }),
}));

describe('useMcpSettingsViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes mcpEnabled from settings', () => {
    const { result } = renderHook(() => useMcpSettingsViewModel());
    expect(result.current.mcpEnabled).toBe(false);
  });

  it('delegates toggle to updateMcpEnabled', () => {
    const { result } = renderHook(() => useMcpSettingsViewModel());

    act(() => {
      result.current.toggleMcp(true);
    });

    expect(mockUpdateMcpEnabled).toHaveBeenCalledWith(true);
  });

  it('exposes email from auth user', () => {
    const { result } = renderHook(() => useMcpSettingsViewModel());
    expect(result.current.email).toBe('test@example.com');
  });

  it('generates config JSON with email auth', () => {
    const { result } = renderHook(() => useMcpSettingsViewModel());
    const config = result.current.configJson;

    expect(config).toContain('mcpServers');
    expect(config).toContain('noheir');
    expect(config).toContain('SUPABASE_EMAIL');
    expect(config).toContain('test@example.com');
    expect(config).toContain('SUPABASE_PASSWORD');
  });
});
