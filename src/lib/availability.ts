export interface AvailabilityInfo {
  availableDate: string | null;
  isAvailable: boolean;
  daysUntilAvailable: number | null;
  daysUntilLocked: number | null;
  latestInvestDate: string | null;
}

export interface LatestInvestLog {
  operationDate: string;
}

export interface ProductLockInfo {
  lockPeriodDays: number | null;
  openDays: number | null;
  cycleDays: number | null;
}

export function computeAvailability(
  latestInvestLog: LatestInvestLog | null,
  product: ProductLockInfo | null,
  today: Date = new Date(),
  availableDateOverride: string | null = null,
): AvailabilityInfo {
  const latestInvestDate = latestInvestLog?.operationDate ?? null;

  if (availableDateOverride) {
    return fromUnlockDate(
      parseCalendarDay(availableDateOverride),
      product,
      today,
      latestInvestDate,
    );
  }

  if (!product || !latestInvestLog) {
    return {
      availableDate: null,
      isAvailable: false,
      daysUntilAvailable: null,
      daysUntilLocked: null,
      latestInvestDate,
    };
  }

  const lockDays = product.lockPeriodDays ?? 0;
  const investDate = parseCalendarDay(latestInvestLog.operationDate);
  return fromUnlockDate(addDays(investDate, lockDays), product, today, latestInvestDate);
}

function fromUnlockDate(
  initialUnlockDate: Date,
  product: ProductLockInfo | null,
  today: Date,
  latestInvestDate: string | null,
): AvailabilityInfo {
  const initialUnlockDateStr = formatDateString(initialUnlockDate);
  const todayStart = parseCalendarDay(shanghaiCalendarDay(today));
  const daysToInitialUnlock = Math.round(
    (initialUnlockDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysToInitialUnlock > 0) {
    return {
      availableDate: initialUnlockDateStr,
      isAvailable: false,
      daysUntilAvailable: daysToInitialUnlock,
      daysUntilLocked: null,
      latestInvestDate,
    };
  }

  if (product?.openDays == null || product.cycleDays == null) {
    return {
      availableDate: initialUnlockDateStr,
      isAvailable: true,
      daysUntilAvailable: daysToInitialUnlock,
      daysUntilLocked: null,
      latestInvestDate,
    };
  }

  const daysSinceUnlock = -daysToInitialUnlock;
  const positionInCycle = daysSinceUnlock % product.cycleDays;

  if (positionInCycle < product.openDays) {
    const windowStart = addDays(todayStart, -positionInCycle);
    return {
      availableDate: formatDateString(windowStart),
      isAvailable: true,
      daysUntilAvailable: 0,
      daysUntilLocked: product.openDays - positionInCycle,
      latestInvestDate,
    };
  }

  const daysUntilNextOpen = product.cycleDays - positionInCycle;
  const nextOpenDate = addDays(todayStart, daysUntilNextOpen);
  return {
    availableDate: formatDateString(nextOpenDate),
    isAvailable: false,
    daysUntilAvailable: daysUntilNextOpen,
    daysUntilLocked: null,
    latestInvestDate,
  };
}

/**
 * All date math here runs on calendar days in Asia/Shanghai, anchored to UTC
 * midnight. Some production operation_date values are full ISO timestamps
 * (docs/003 § B2c); only the YYYY-MM-DD prefix is used.
 */
function parseCalendarDay(day: string): Date {
  const ymd = /^\d{4}-\d{2}-\d{2}/.exec(day)?.[0];
  if (!ymd) return new Date(Number.NaN);
  return new Date(`${ymd}T00:00:00Z`);
}

function shanghaiCalendarDay(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
