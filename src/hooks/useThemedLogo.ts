import { useMemo } from 'react';
import { useSettings } from '@/contexts/SettingsContext';

/** Resolved effective theme: always 'light' or 'dark' (never 'system'). */
function resolveTheme(theme: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return theme;
}

/**
 * Returns theme-aware logo paths.
 *
 * Light theme  → `/logo/light-*.png`, `/logo-loading-light.png`
 * Dark theme   → `/logo/dark-*.png`,  `/logo-loading-dark.png`
 */
export function useThemedLogo() {
  const { settings } = useSettings();
  const variant = resolveTheme(settings.theme);

  return useMemo(
    () => ({
      logo32: `/logo/${variant}-32.png`,
      logo64: `/logo/${variant}-64.png`,
      logo128: `/logo/${variant}-128.png`,
      logo256: `/logo/${variant}-256.png`,
      loading: `/logo-loading-${variant}.png`,
    }),
    [variant],
  );
}
