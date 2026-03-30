/**
 * Application version info.
 *
 * Reads from package.json at import time. For git-hash enriched versions,
 * use scripts/generate-version.ts to generate version-generated.ts.
 */

/** Semantic version from package.json */
export const APP_VERSION = "2.0.0";

/** Human-readable name for the /api/live response */
export const APP_NAME = "noheir";
