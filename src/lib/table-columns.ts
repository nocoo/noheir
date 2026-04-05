/**
 * Unified table column width configuration for capital-related tables.
 * Ensures consistent column widths across different pages.
 */

export const CAPITAL_TABLE_COLUMNS = {
  /** Unit code column (e.g., C10, A01) */
  unitCode: "w-[90px]",
  /** Strategy column (e.g., 远期理财) */
  strategy: "w-[100px]",
  /** Tactics column (e.g., 定期存款) */
  tactics: "w-[100px]",
  /** Product name column */
  product: "w-[120px]",
  /** Status column (e.g., 已成立) */
  status: "w-[80px]",
  /** Currency column (e.g., CNY) */
  currency: "w-[60px]",
  /** Amount column (right-aligned) */
  amount: "w-[110px] text-right",
  /** Date column */
  date: "w-[100px]",
  /** Countdown/availability column */
  countdown: "w-[80px] text-right",
  /** Urgency badge column */
  urgency: "w-[80px]",
  /** Actions column (edit/delete buttons) */
  actions: "w-[80px]",
  /** Note column (truncated) */
  note: "w-[120px] max-w-[120px]",
  /** Reason/description column (flexible) */
  reason: "min-w-[100px]",
  /** Operation type column */
  operationType: "w-[90px]",
  /** Source column */
  source: "w-[70px]",
} as const;

export type CapitalTableColumn = keyof typeof CAPITAL_TABLE_COLUMNS;
