/**
 * "Today" as the user experiences it.
 *
 * The Worker anchors every server-side date to Asia/Shanghai
 * (worker/src/index.ts getLocalDateString). The web layer must agree, or a log
 * created between 00:00 and 07:59 local time defaults to the previous day —
 * the same class of defect as docs/003 § B4.
 */

const APP_TIME_ZONE = "Asia/Shanghai";

/** Local calendar date as YYYY-MM-DD. `en-CA` formats exactly that way. */
export function getLocalDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
}

/**
 * Render an `operation_date` as YYYY-MM-DD.
 *
 * 132 production rows hold a full ISO timestamp in that column because the MCP
 * writer bound one (docs/003 § B2c). The writer is fixed, but those rows are not
 * backfilled ("存量不管"), so the display layer trims them rather than letting a
 * 24-character string wrap inside the timeline.
 */
export function formatOperationDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const isoDatePart = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDatePart) ? isoDatePart : value;
}

/** Shift a YYYY-MM-DD calendar day by `days`, anchored to UTC midnight. */
export function addCalendarDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const date = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}
