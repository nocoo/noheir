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
): AvailabilityInfo {
  if (!product || !latestInvestLog) {
    return {
      availableDate: null,
      isAvailable: false,
      daysUntilAvailable: null,
      daysUntilLocked: null,
      latestInvestDate: latestInvestLog?.operationDate ?? null,
    };
  }

  const lockDays = product.lockPeriodDays ?? 0;
  const investDate = new Date(latestInvestLog.operationDate);

  const initialUnlockDate = new Date(investDate);
  initialUnlockDate.setDate(initialUnlockDate.getDate() + lockDays);
  const initialUnlockDateStr = formatDateString(initialUnlockDate);

  const todayStart = startOfDay(today);
  const initialUnlockStart = startOfDay(initialUnlockDate);
  const daysToInitialUnlock = Math.round(
    (initialUnlockStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Still in initial lock period
  if (daysToInitialUnlock > 0) {
    return {
      availableDate: initialUnlockDateStr,
      isAvailable: false,
      daysUntilAvailable: daysToInitialUnlock,
      daysUntilLocked: null,
      latestInvestDate: latestInvestLog.operationDate,
    };
  }

  // No cyclic config — permanently unlocked (backward compatible)
  if (product.openDays == null || product.cycleDays == null) {
    return {
      availableDate: initialUnlockDateStr,
      isAvailable: true,
      daysUntilAvailable: daysToInitialUnlock,
      daysUntilLocked: null,
      latestInvestDate: latestInvestLog.operationDate,
    };
  }

  // Cyclic lock logic
  const daysSinceUnlock = -daysToInitialUnlock; // positive number of days past unlock
  const positionInCycle = daysSinceUnlock % product.cycleDays;

  if (positionInCycle < product.openDays) {
    // In open window — availableDate = current window start
    const windowStart = new Date(todayStart);
    windowStart.setDate(windowStart.getDate() - positionInCycle);
    return {
      availableDate: formatDateString(windowStart),
      isAvailable: true,
      daysUntilAvailable: 0,
      daysUntilLocked: product.openDays - positionInCycle,
      latestInvestDate: latestInvestLog.operationDate,
    };
  }

  // In locked window — availableDate = next open window start
  const daysUntilNextOpen = product.cycleDays - positionInCycle;
  const nextOpenDate = new Date(todayStart);
  nextOpenDate.setDate(nextOpenDate.getDate() + daysUntilNextOpen);
  return {
    availableDate: formatDateString(nextOpenDate),
    isAvailable: false,
    daysUntilAvailable: daysUntilNextOpen,
    daysUntilLocked: null,
    latestInvestDate: latestInvestLog.operationDate,
  };
}

function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
