/**
 * Application version info.
 *
 * Reads from package.json at import time so the root package.json stays the
 * single source of truth (resolveJsonModule is enabled in tsconfig).
 */

import pkg from "../../package.json";

/** Semantic version from package.json (auto-resolved at build time) */
export const APP_VERSION: string = pkg.version;

/** Human-readable name for the /api/live response */
export const APP_NAME = "noheir";
