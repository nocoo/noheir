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
