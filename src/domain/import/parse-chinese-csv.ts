/**
 * Parse Chinese-header CSV files exported from an external finance app.
 *
 * Expected header:
 *   日期,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注
 *
 * Output rows use camelCase field names matching the Drizzle ORM schema
 * (amountCents as integer, tags as JSON string).
 *
 * Ported from Gen1 `_archive/src/lib/csvParser.ts`.
 */

import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  findSecondaryCategory,
} from "./category-mapping";

// ── Types ──

export interface ParsedTransactionRow {
  date: string;
  year: number;
  month: number;
  day: number;
  primaryCategory: string;
  secondaryCategory: string;
  tertiaryCategory: string;
  amountCents: number;
  type: string; // "income" | "expense"
  account: string;
  currency: string;
  tags: string; // JSON string: '["tag1","tag2"]'
  note: string | null;
  rawIndex: number;
  hasSecondaryMapping: boolean; // SQLite boolean via Drizzle mode: "boolean"
}

export interface ParseError {
  row: number;
  message: string;
  data: string[];
}

export interface ParseWarning {
  row: number;
  message: string;
}

export interface ChineseCSVParseResult {
  transactions: ParsedTransactionRow[];
  errors: ParseError[];
  warnings: ParseWarning[];
  /** Count of full-refund records (0 amount with refund note) safely skipped */
  skippedRefunds: number;
}

// ── Internal helpers ──

const EXPECTED_HEADERS = [
  "日期",
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

/** Parse a currency string like "123.45" or "¥1,234.56" to cents (integer). */
function parseToCents(value: string): number {
  if (!value || value.trim() === "" || value === "0.00") return 0;
  const cleaned = value.replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleaned);
  if (Number.isNaN(parsed)) return 0;
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

/** Parse date string and extract year, month, day. */
function parseDateParts(dateStr: string): {
  year: number;
  month: number;
  day: number;
  valid: boolean;
} {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return { year: 0, month: 0, day: 0, valid: false };
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    valid: true,
  };
}

/** Determine transaction type from inflow/outflow amounts. */
function determineType(inflowCents: number, outflowCents: number): "income" | "expense" {
  if (inflowCents > 0 && outflowCents === 0) return "income";
  if (outflowCents > 0 && inflowCents === 0) return "expense";
  return inflowCents >= outflowCents ? "income" : "expense";
}

// ── Public API ──

/**
 * Parse Chinese-header transaction CSV content.
 *
 * Returns parsed rows matching the D1 transactions schema, plus errors/warnings.
 */
/** Detect if a note indicates a full refund (e.g., "<全额退款：原支出金额:10.58，退款金额:10.58>商品名") */
function isFullRefundNote(note: string): boolean {
  return note.startsWith("<全额退款") || note.includes("(已全额退款)");
}

export function parseChineseCSV(content: string): ChineseCSVParseResult {
  const lines = content.trim().split(/\r?\n/);
  const transactions: ParsedTransactionRow[] = [];
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  let skippedRefunds = 0;

  if (lines.length < 2) {
    return {
      transactions,
      errors: [{ row: 0, message: "CSV 文件为空或只有表头", data: [] }],
      warnings,
      skippedRefunds,
    };
  }

  // Validate header
  const headers = parseCSVLine(lines[0] ?? "");
  const missingHeaders = EXPECTED_HEADERS.filter((h) => !headers.includes(h));

  if (missingHeaders.length > 0) {
    return {
      transactions,
      errors: [
        {
          row: 1,
          message: `CSV 表头格式错误。缺少以下列: ${missingHeaders.join(", ")}`,
          data: headers,
        },
      ],
      warnings,
      skippedRefunds,
    };
  }

  if (headers.length > 9) {
    warnings.push({
      row: 1,
      message: `CSV 表头包含额外列 (期望 9 列，实际 ${headers.length} 列)，将忽略多余列`,
    });
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length < 5) {
      errors.push({
        row: i + 1,
        message: `列数不足 (至少需要 5 列，实际 ${values.length} 列)`,
        data: values,
      });
      continue;
    }

    try {
      const dateStr = values[0] || "";
      const primaryCategory = values[1] || "未分类";
      let tertiaryCategory = values[2] || "未分类";

      // Auto-extract tertiary category if it contains "/" (e.g., "理财收入 / JY040205...")
      if (tertiaryCategory.includes("/")) {
        const extracted = (tertiaryCategory.split("/")[0] ?? "").trim();
        if (extracted) tertiaryCategory = extracted;
      }

      const inflowStr = values[3] || "0.00";
      const outflowStr = values[4] || "0.00";
      const currency = values[5] || "人民币";
      const account = values[6] || "未知账户";
      const tagsStr = values[7] || "";
      const note = values[8] || "";

      // Parse amounts to cents
      const inflowCents = parseToCents(inflowStr);
      const outflowCents = parseToCents(outflowStr);
      const amountCents = inflowCents > 0 ? inflowCents : outflowCents;

      // Skip zero-amount rows
      if (amountCents === 0) {
        if (isFullRefundNote(note)) {
          // Full refund: safe to skip silently, just count it
          skippedRefunds++;
        } else {
          // Other zero-amount: warn user
          warnings.push({
            row: i + 1,
            message: "流入和流出金额均为 0，跳过此记录",
          });
        }
        continue;
      }

      // Parse date
      const dateParts = parseDateParts(dateStr);
      if (!dateParts.valid) {
        errors.push({
          row: i + 1,
          message: `日期格式无效: ${dateStr}`,
          data: values,
        });
        continue;
      }

      // Determine type
      const type = determineType(inflowCents, outflowCents);

      // Special handling: 余额调整 → 对账收入/对账支出
      if (tertiaryCategory === "余额调整") {
        tertiaryCategory = type === "income" ? "对账收入" : "对账支出";
      }

      // Map tertiary → secondary category
      let hasMapping = true;
      let secondaryCategory = "未分类";

      const secondary = findSecondaryCategory(primaryCategory, tertiaryCategory, type);
      hasMapping = secondary !== null;
      secondaryCategory = secondary || "未分类";

      // If tertiary is actually a secondary name, remap
      if (!hasMapping) {
        const mappings = type === "income" ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
        if (mappings[tertiaryCategory]) {
          secondaryCategory = tertiaryCategory;
          const firstTertiary = mappings[tertiaryCategory]?.[0];
          if (firstTertiary) tertiaryCategory = firstTertiary;
          hasMapping = true;
        }
      }

      transactions.push({
        date: dateStr,
        year: dateParts.year,
        month: dateParts.month,
        day: dateParts.day,
        primaryCategory: primaryCategory,
        secondaryCategory: secondaryCategory,
        tertiaryCategory: tertiaryCategory,
        amountCents: amountCents,
        type,
        account,
        currency,
        tags: parseTags(tagsStr),
        note: note || null,
        rawIndex: i + 1,
        hasSecondaryMapping: hasMapping,
      });
    } catch (err) {
      errors.push({
        row: i + 1,
        message: err instanceof Error ? err.message : "未知解析错误",
        data: values,
      });
    }
  }

  return { transactions, errors, warnings, skippedRefunds };
}
