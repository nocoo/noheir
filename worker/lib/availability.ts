/**
 * Availability computation for capital units.
 *
 * availableDate = latestInvest.operationDate + product.lockPeriodDays
 *
 * Truth table:
 * - availableDate = null → isAvailable = false (data insufficient)
 * - availableDate != null && today >= availableDate → isAvailable = true
 * - availableDate != null && today < availableDate → isAvailable = false
 *
 * daysUntilAvailable:
 * - null if availableDate is null
 * - positive if locked
 * - zero or negative if available (negative = available since N days ago)
 */

export interface AvailabilityInfo {
  availableDate: string | null;
  isAvailable: boolean;
  daysUntilAvailable: number | null;
  latestInvestDate: string | null;
}

export interface LatestInvestLog {
  operationDate: string;
}

export interface ProductLockInfo {
  lockPeriodDays: number | null;
}

/**
 * Compute availability info for a capital unit.
 *
 * @param latestInvestLog - The most recent invest log for this unit, or null if none
 * @param product - The product the unit is deployed to, or null if not deployed
 * @param today - Reference date for calculation (defaults to now)
 */
export function computeAvailability(
  latestInvestLog: LatestInvestLog | null,
  product: ProductLockInfo | null,
  today: Date = new Date()
): AvailabilityInfo {
  // No product or no invest log → data insufficient
  if (!product || !latestInvestLog) {
    return {
      availableDate: null,
      isAvailable: false,
      daysUntilAvailable: null,
      latestInvestDate: latestInvestLog?.operationDate ?? null,
    };
  }

  const lockDays = product.lockPeriodDays ?? 0;
  const investDate = new Date(latestInvestLog.operationDate);

  // Add lock period days to get available date
  const available = new Date(investDate);
  available.setDate(available.getDate() + lockDays);
  const availableDateStr = formatDateString(available);

  // Calculate days until available (can be negative if already available)
  const todayStart = startOfDay(today);
  const availableStart = startOfDay(available);
  const diffMs = availableStart.getTime() - todayStart.getTime();
  const daysUntilAvailable = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const isAvailable = daysUntilAvailable <= 0;

  return {
    availableDate: availableDateStr,
    isAvailable,
    daysUntilAvailable,
    latestInvestDate: latestInvestLog.operationDate,
  };
}

/**
 * Format date as YYYY-MM-DD string.
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get start of day (midnight) for a date.
 */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
