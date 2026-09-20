export type RecurringStatus = "active" | "paused" | "ended";
export type RecurringTransition = "pause" | "resume" | "end";

export const ALLOWED_FROM: Record<RecurringTransition, readonly RecurringStatus[]> = {
  pause: ["active"],
  resume: ["paused"],
  end: ["active", "paused"],
};

export function utcTodayIso(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isRecurringStatus(value: string): value is RecurringStatus {
  return value === "active" || value === "paused" || value === "ended";
}

export function isRecurringTransition(value: string): value is RecurringTransition {
  return value === "pause" || value === "resume" || value === "end";
}

export type StatePatch =
  | { ok: true; status: RecurringStatus; endedAt: string | null }
  | { ok: false; reason: "illegal" };

/** Compute the SQL patch. Ended uses UTC YYYY-MM-DD, matching prior Server Action. */
export function patchForTransition(
  transition: RecurringTransition,
  from: RecurringStatus,
  now: Date = new Date(),
): StatePatch {
  if (!ALLOWED_FROM[transition].includes(from)) {
    return { ok: false, reason: "illegal" };
  }
  if (transition === "pause") {
    return { ok: true, status: "paused", endedAt: null };
  }
  if (transition === "resume") {
    return { ok: true, status: "active", endedAt: null };
  }
  return { ok: true, status: "ended", endedAt: utcTodayIso(now) };
}
