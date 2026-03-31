/**
 * Parse Chinese-header transfer CSV files exported from an external finance app.
 *
 * Expected header (10 columns):
 *   日期,收支大类,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注
 *
 * Output rows use camelCase field names matching the Drizzle ORM schema
 * (amountCents as integer, tags as JSON string).
 *
 * Ported from Gen1 `_archive/src/hooks/useTransfers.ts#parseTransferCSV`.
 */

// ── Types ──

export interface ParsedTransferRow {
  date: string;
  year: number;
  month: number;
  day: number;
  primaryCategory: string | null;
  secondaryCategory: string;
  transactionType: string;
  inflowAmountCents: number;
  outflowAmountCents: number;
  currency: string;
  account: string;
  tags: string; // JSON string: '["tag1","tag2"]'
  note: string | null;
  rawIndex: number;
}

export interface TransferParseError {
  row: number;
  message: string;
}

export interface TransferParseWarning {
  row: number;
  message: string;
}

export interface ChineseTransferCSVParseResult {
  transfers: ParsedTransferRow[];
  errors: TransferParseError[];
  warnings: TransferParseWarning[];
  filteredCount: number; // number of "转账 / 优惠抵扣" rows skipped
}

// ── Internal helpers ──

const EXPECTED_HEADERS = [
  "日期",
  "收支大类",
  "交易分类",
  "交易类型",
  "流入金额",
  "流出金额",
  "币种",
  "资金账户",
  "标签",
  "备注",
];

/** Parse a CSV line, handling quoted fields with commas and escaped quotes. */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i] ?? "";
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/** Parse a currency string to cents (integer). */
function parseToCents(value: string): number {
  if (!value || value.trim() === "" || value === "0.00") return 0;
  const cleaned = value.replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(Math.abs(parsed) * 100);
}

/** Parse comma-separated tags into a JSON array string. */
function parseTags(tagsStr: string): string {
  if (!tagsStr || tagsStr.trim() === "") return "[]";
  const arr = tagsStr
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "");
  return JSON.stringify(arr);
}

// ── Public API ──

/**
 * Parse Chinese-header transfer CSV content.
 *
 * Filters out "转账 / 优惠抵扣" rows automatically (they are already
 * recorded as income in the transaction CSV).
 */
export function parseChineseTransferCSV(
  content: string,
): ChineseTransferCSVParseResult {
  const lines = content.trim().split(/\r?\n/);
  const transfers: ParsedTransferRow[] = [];
  const errors: TransferParseError[] = [];
  const warnings: TransferParseWarning[] = [];
  let filteredCount = 0;

  if (lines.length < 2) {
    return {
      transfers,
      errors: [{ row: 0, message: "CSV 文件为空或只有表头" }],
      warnings,
      filteredCount,
    };
  }

  // Validate header
  const headers = parseCSVLine(lines[0] ?? "");
  const missingHeaders = EXPECTED_HEADERS.filter((h) => !headers.includes(h));

  if (missingHeaders.length > 0) {
    return {
      transfers,
      errors: [
        {
          row: 1,
          message: `CSV 表头格式错误。缺少以下列: ${missingHeaders.join(", ")}`,
        },
      ],
      warnings,
      filteredCount,
    };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length < EXPECTED_HEADERS.length) {
      errors.push({
        row: i + 1,
        message: `列数不足 (期望 ${EXPECTED_HEADERS.length} 列，实际 ${values.length} 列)`,
      });
      continue;
    }

    const dateStr = values[0]?.trim() || "";
    const primaryCategory = values[1]?.trim() || "";
    const secondaryCategory = values[2]?.trim() || "转账";
    const transactionType = values[3]?.trim() || "";
    const inflowStr = values[4]?.trim() || "0";
    const outflowStr = values[5]?.trim() || "0";
    const currency = values[6]?.trim() || "人民币";
    const account = values[7]?.trim() || "";
    const tagsStr = values[8]?.trim() || "";
    const note = values[9]?.trim() || "";

    // Filter out "转账 / 优惠抵扣"
    if (transactionType === "转账 / 优惠抵扣") {
      filteredCount++;
      continue;
    }

    // Parse date
    const dateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) {
      errors.push({ row: i + 1, message: `日期格式无效: ${dateStr}` });
      continue;
    }

    const year = parseInt(dateMatch[1] ?? "0", 10);
    const month = parseInt(dateMatch[2] ?? "0", 10);
    const day = parseInt(dateMatch[3] ?? "0", 10);

    transfers.push({
      date: dateStr,
      year,
      month,
      day,
      primaryCategory: primaryCategory || null,
      secondaryCategory: secondaryCategory,
      transactionType: transactionType,
      inflowAmountCents: parseToCents(inflowStr),
      outflowAmountCents: parseToCents(outflowStr),
      currency,
      account,
      tags: parseTags(tagsStr),
      note: note || null,
      rawIndex: i,
    });
  }

  return { transfers, errors, warnings, filteredCount };
}
