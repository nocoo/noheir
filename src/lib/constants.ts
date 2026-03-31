/**
 * Maximum number of rows to fetch when loading full-year data for
 * dashboard aggregation. Must stay in sync with the worker-side
 * `clampLimit` ceiling (currently 10 000).
 */
export const FULL_YEAR_LIMIT = 10_000;
