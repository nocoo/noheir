import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useAISettingsViewModel } from '../../src/viewmodels/settings/useAISettingsViewModel';

const mockUpdateAIConfig = vi.fn();
const mockUpdateAIEnabled = vi.fn();

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      aiConfig: {
        enabled: true,
        baseURL: 'https://api.openai.com/v1',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-test',
      },
    },
    updateAIConfig: mockUpdateAIConfig,
    updateAIEnabled: mockUpdateAIEnabled,
  }),
}));

describe('useAISettingsViewModel', () => {
  const toast = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates url and keeps customUrl in sync', () => {
    const { result } = renderHook(() => useAISettingsViewModel(toast));

    act(() => {
      result.current.handleUrlChange('https://api.openai.com/v1');
    });

    expect(mockUpdateAIConfig).toHaveBeenCalled();
  });

  it('saves final config and shows toast', () => {
    const { result } = renderHook(() => useAISettingsViewModel(toast));

    act(() => {
      result.current.handleSave();
    });

    expect(mockUpdateAIConfig).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it('tests config successfully', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{}] }),
    });

    const { result } = renderHook(() => useAISettingsViewModel(toast));

    await act(async () => {
      await result.current.handleTest(fetcher as unknown as typeof fetch);
    });

    expect(fetcher).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it('handles test failure', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    const { result } = renderHook(() => useAISettingsViewModel(toast));

    await act(async () => {
      await result.current.handleTest(fetcher as unknown as typeof fetch);
    });

    expect(toast.error).toHaveBeenCalled();
  });
});
