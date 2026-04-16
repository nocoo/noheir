import pkg from "../../package.json";

/** Semantic version from package.json (auto-resolved at build time) */
export const APP_VERSION: string = pkg.version;

/** Component name for surety-standard /api/live */
export const COMPONENT_NAME = "noheir-worker";
