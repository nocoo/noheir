/**
 * Return rate settings domain logic.
 *
 * Manages:
 * - Minimum return rate threshold (below = underperforming)
 * - Maximum return rate threshold (above = high risk)
 */

// ── Constants ──

export const DEFAULT_MIN_RETURN_RATE = 1.25;
export const DEFAULT_MAX_RETURN_RATE = 4.0;
export const MIN_RETURN_RATE_BOUND = 0;
export const MAX_RETURN_RATE_BOUND = 15;

// ── Helpers ──

export const clampReturnRate = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

export const clampMinReturnRate = (value: number): number => {
  return clampReturnRate(value, MIN_RETURN_RATE_BOUND, 10);
};

export const clampMaxReturnRate = (value: number): number => {
  return clampReturnRate(value, MIN_RETURN_RATE_BOUND, MAX_RETURN_RATE_BOUND);
};

// ── Status types ──

export type ReturnRateStatus = "low" | "normal" | "high";

/**
 * Determine the status of a return rate based on thresholds.
 */
export function getReturnRateStatus(
  rate: number,
  minThreshold: number,
  maxThreshold: number,
): ReturnRateStatus {
  if (rate < minThreshold) return "low";
  if (rate > maxThreshold) return "high";
  return "normal";
}

/**
 * Get Tailwind text color class for return rate status.
 */
export function getReturnRateTextClass(status: ReturnRateStatus): string {
  switch (status) {
    case "low":
      return "text-amber-600 dark:text-amber-400";
    case "high":
      return "text-rose-600 dark:text-rose-400";
    case "normal":
    default:
      return "text-emerald-600 dark:text-emerald-400";
  }
}

/**
 * Get Tailwind background color class for return rate status.
 */
export function getReturnRateBgClass(status: ReturnRateStatus): string {
  switch (status) {
    case "low":
      return "bg-amber-50 dark:bg-amber-500/10";
    case "high":
      return "bg-rose-50 dark:bg-rose-500/10";
    case "normal":
    default:
      return "bg-emerald-50 dark:bg-emerald-500/10";
  }
}

/**
 * Get description for return rate status.
 */
export function getReturnRateDescription(status: ReturnRateStatus): string {
  switch (status) {
    case "low":
      return "收益率偏低，资金利用效率可能不足";
    case "high":
      return "收益率较高，可能存在较大风险";
    case "normal":
    default:
      return "收益率正常";
  }
}
