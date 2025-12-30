// Version management utilities
// Format: v0.1-{shortGitHash}

let cachedVersion: string | null = null;

/**
 * Get the current application version
 * Format: v0.1-{gitShortHash}
 * Example: v0.1-a3f2b1c
 */
export async function getAppVersion(): Promise<string> {
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    // Try to get version from git
    const response = await fetch('/version.json');
    if (response.ok) {
      const data = await response.json();
      cachedVersion = data.version;
      return cachedVersion;
    }
  } catch (err) {
    console.warn('Failed to fetch version.json:', err);
  }

  // Fallback: try to get from package.json during dev
  try {
    const response = await fetch('/version.txt');
    if (response.ok) {
      cachedVersion = await response.text();
      return cachedVersion;
    }
  } catch (err) {
    console.warn('Failed to fetch version.txt:', err);
  }

  // Final fallback
  cachedVersion = 'v0.1-dev';
  return cachedVersion;
}

/**
 * Get version synchronously (returns cached version or fallback)
 */
export function getVersionSync(): string {
  return cachedVersion || 'v0.1-dev';
}
