/**
 * Unified table column width configuration for capital-related tables.
 * Ensures consistent column widths across different pages.
 */

export const CAPITAL_TABLE_COLUMNS = {
  /** Unit code column (e.g., C10, A01) */
  unitCode: "w-[90px] whitespace-nowrap",
  /** Strategy column (e.g., 远期理财) */
  strategy: "w-[100px] whitespace-nowrap",
  /** Tactics column (e.g., 定期存款) */
  tactics: "w-[100px] whitespace-nowrap",
  /** Product name column */
  product: "w-[120px] whitespace-nowrap",
  /** Status column (e.g., 已成立) */
  status: "w-[80px] whitespace-nowrap",
  /** Currency column (e.g., CNY) */
  currency: "w-[60px] whitespace-nowrap",
  /** Amount column (right-aligned) */
  amount: "w-[110px] text-right whitespace-nowrap",
  /** Date column */
  date: "w-[100px] whitespace-nowrap",
  /** Countdown/availability column */
  countdown: "w-[80px] text-right whitespace-nowrap",
  /** Urgency badge column */
  urgency: "w-[80px] whitespace-nowrap",
  /** Actions column (edit/delete buttons) */
  actions: "w-[80px] whitespace-nowrap",
  /** Note column (truncated) */
  note: "w-[120px] max-w-[120px]",
  /** Reason/description column (flexible) */
  reason: "min-w-[100px]",
  /** Operation type column */
  operationType: "w-[90px] whitespace-nowrap",
  /** Source column */
  source: "w-[70px] whitespace-nowrap",
} as const;

export type CapitalTableColumn = keyof typeof CAPITAL_TABLE_COLUMNS;
