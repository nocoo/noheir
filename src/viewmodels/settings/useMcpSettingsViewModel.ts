import { useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { buildMcpConfigJson, getMcpProjectPath } from '@/domain/settings/mcpConfig';

type RefreshSessionFn = () => Promise<{
  data: { session: { refresh_token: string } | null };
  error: { message: string } | null;
}>;

export function useMcpSettingsViewModel(refreshSessionFn?: RefreshSessionFn) {
  const { settings, updateMcpEnabled } = useSettings();
  const { session } = useAuth();

  const [refreshToken, setRefreshToken] = useState(session?.refresh_token ?? '');
  const [refreshError, setRefreshError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const toggleMcp = (enabled: boolean) => {
    updateMcpEnabled(enabled);
  };

  const handleRefreshToken = async () => {
    if (!refreshSessionFn) return;

    setRefreshing(true);
    setRefreshError('');

    try {
      const { data, error } = await refreshSessionFn();

      if (error) {
        setRefreshError(error.message);
        return;
      }

      if (data.session?.refresh_token) {
        setRefreshToken(data.session.refresh_token);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const configJson = buildMcpConfigJson({
    refreshToken,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '<anon-key>',
    projectPath: getMcpProjectPath(),
  });

  return {
    mcpEnabled: settings.mcpEnabled,
    refreshToken,
    refreshError,
    refreshing,
    configJson,
    toggleMcp,
    handleRefreshToken,
  };
}
