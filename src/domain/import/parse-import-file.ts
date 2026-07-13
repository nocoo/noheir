/**
 * Pure functions for parsing import files (JSON / CSV).
 * Client-side only — enables instant validation before server submission.
 */

export interface ParseResult {
  transactions: Record<string, unknown>[];
  transfers: Record<string, unknown>[];
  errors: string[];
}

/**
 * Parse a JSON import string.
 * Expects `{ transactions: [...], transfers: [...] }` structure.
 * Also accepts backup format with extra keys (products, units, settings).
 */
export function parseJsonImport(content: string): ParseResult {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { transactions: [], transfers: [], errors: ["Invalid JSON format"] };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      transactions: [],
      transfers: [],
      errors: ["JSON must be an object with transactions/transfers arrays"],
    };
  }

  const obj = parsed as Record<string, unknown>;
  const transactions = Array.isArray(obj.transactions) ? obj.transactions : [];
  const transfers = Array.isArray(obj.transfers) ? obj.transfers : [];

  if (!Array.isArray(obj.transactions) && !Array.isArray(obj.transfers)) {
    errors.push(
      "No transactions or transfers found in JSON. Expected { transactions: [...], transfers: [...] }",
    );
  }

  // Validate each transaction has at least required fields
  const validTransactions: Record<string, unknown>[] = [];
  for (let i = 0; i < transactions.length; i++) {
    const row = transactions[i];
    if (typeof row !== "object" || row === null) {
      errors.push(`Transaction at index ${i}: not a valid object`);
      continue;
    }
    validTransactions.push(row as Record<string, unknown>);
  }

  const validTransfers: Record<string, unknown>[] = [];
  for (let i = 0; i < transfers.length; i++) {
    const row = transfers[i];
    if (typeof row !== "object" || row === null) {
      errors.push(`Transfer at index ${i}: not a valid object`);
      continue;
    }
    validTransfers.push(row as Record<string, unknown>);
  }

  return {
    transactions: validTransactions,
    transfers: validTransfers,
    errors,
  };
}

// ── CSV parsing ──

/**
 * Transaction CSV expected columns (any order):
 * date, type, primary_category, amount_cents, account, currency,
 * secondary_category, tertiary_category, tags, note
 *
 * Transfer CSV expected columns (any order):
 * date, inflow_amount_cents, outflow_amount_cents, account, currency,
 * primary_category, secondary_category, transaction_type, tags, note
 */

const TRANSACTION_REQUIRED_COLS = ["date", "type", "primary_category", "amount_cents", "account"];
const TRANSFER_REQUIRED_COLS = ["date", "inflow_amount_cents", "outflow_amount_cents", "account"];

function detectCsvType(headers: string[]): "transaction" | "transfer" | null {
  const lower: string[] = headers.map((h) => h.trim().toLowerCase());
  const hasTransactionCols = TRANSACTION_REQUIRED_COLS.every((c: string) => lower.includes(c));
  const hasTransferCols = TRANSFER_REQUIRED_COLS.every((c: string) => lower.includes(c));

  if (hasTransferCols) return "transfer";
  if (hasTransactionCols) return "transaction";
  return null;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
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

export function parseCsvImport(content: string): ParseResult {
  const errors: string[] = [];
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (lines.length < 2) {
    return {
      transactions: [],
      transfers: [],
      errors: ["CSV file is empty or has no data rows"],
    };
  }

  const headerLine = lines[0];
  if (!headerLine) {
    return {
      transactions: [],
      transfers: [],
      errors: ["CSV file is empty or has no data rows"],
    };
  }

  const headers = splitCsvLine(headerLine);
  const type = detectCsvType(headers);

  if (!type) {
    return {
      transactions: [],
      transfers: [],
      errors: [
        `Cannot detect CSV type. Required columns for transactions: ${TRANSACTION_REQUIRED_COLS.join(", ")}. For transfers: ${TRANSFER_REQUIRED_COLS.join(", ")}`,
      ],
    };
  }

  const rows: Record<string, unknown>[] = [];
  const lowerHeaders = headers.map((h) => h.trim().toLowerCase());

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = splitCsvLine(line);
    if (values.length !== headers.length) {
      errors.push(`Row ${i + 1}: expected ${headers.length} columns, got ${values.length}`);
      continue;
    }

    const row: Record<string, unknown> = {};
    for (let j = 0; j < lowerHeaders.length; j++) {
      const key = lowerHeaders[j] ?? "";
      const val = values[j] ?? "";

      // Parse numeric fields
      if (
        key === "amount_cents" ||
        key === "inflow_amount_cents" ||
        key === "outflow_amount_cents"
      ) {
        row[key] = val ? Number(val) : 0;
      } else if (key === "tags") {
        // Tags stored as pipe-separated or comma-in-quotes
        row[key] = val
          ? val
              .split("|")
              .map((t) => t.trim())
              .filter(Boolean)
          : [];
      } else {
        row[key] = val || null;
      }
    }
    rows.push(row);
  }

  return {
    transactions: type === "transaction" ? rows : [],
    transfers: type === "transfer" ? rows : [],
    errors,
  };
}

/**
 * Auto-detect format and parse.
 */
export function parseImportFile(content: string, fileName: string): ParseResult {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "json") return parseJsonImport(content);
  if (ext === "csv") return parseCsvImport(content);
  return {
    transactions: [],
    transfers: [],
    errors: [`Unsupported file format: .${ext}. Use .json or .csv`],
  };
}
