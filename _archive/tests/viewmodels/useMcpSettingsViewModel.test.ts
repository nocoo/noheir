import { describe, expect, it, vi } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useMcpSettingsViewModel } from '../../src/viewmodels/settings/useMcpSettingsViewModel';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      email: 'test@example.com',
    },
  }),
}));

describe('useMcpSettingsViewModel', () => {
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
