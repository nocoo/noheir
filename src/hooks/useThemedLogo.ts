import { useMemo } from 'react';

/**
 * Returns logo paths (unified transparent logo, no theme switching needed).
 */
export function useThemedLogo() {
  return useMemo(
    () => ({
      logo32: '/logo/logo-32.png',
      logo64: '/logo/logo-64.png',
      logo128: '/logo/logo-128.png',
      logo256: '/logo/logo-256.png',
      loading: '/logo-loading.png',
    }),
    [],
  );
}
