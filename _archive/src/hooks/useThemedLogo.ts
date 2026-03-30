import { useMemo } from 'react';

/**
 * Returns logo paths (unified transparent logo, no theme switching needed).
 *
 * B-3 standard sizes:
 *   logo24  – sidebar header (24×24)
 *   logo80  – login avatar, about page (80×80)
 *
 * Extended sizes kept for PWA / loading:
 *   logo256 – loading splash (256×256)
 */
export function useThemedLogo() {
  return useMemo(
    () => ({
      logo24: '/logo-24.png',
      logo80: '/logo-80.png',
      logo256: '/logo-256.png',
    }),
    [],
  );
}
