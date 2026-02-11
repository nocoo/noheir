import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { buildMcpConfigJson, getMcpProjectPath } from '@/domain/settings/mcpConfig';

export function useMcpSettingsViewModel() {
  const { settings, updateMcpEnabled } = useSettings();
  const { user } = useAuth();

  const email = user?.email ?? '';

  const toggleMcp = (enabled: boolean) => {
    updateMcpEnabled(enabled);
  };

  const configJson = buildMcpConfigJson({
    email,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '<anon-key>',
    projectPath: getMcpProjectPath(),
  });

  return {
    mcpEnabled: settings.mcpEnabled,
    email,
    configJson,
    toggleMcp,
  };
}
