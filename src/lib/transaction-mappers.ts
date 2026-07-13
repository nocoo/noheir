import type { DomainTransaction, DomainTransfer, MonthlyData } from "@/domain/types";

/**
 * Parse tags from Worker response.
 * Worker stores tags as JSON string in D1 (e.g., '["tag1","tag2"]').
 * This handles both JSON string and array formats for compatibility.
 */
export function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((t): t is string => typeof t === "string");
  }
  if (typeof raw === "string" && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((t): t is string => typeof t === "string");
      }
    } catch {
      // Not valid JSON, return empty
    }
  }
  return [];
}

/** Map raw Worker transaction (camelCase from Drizzle) to DomainTransaction */
export function toDomainTransaction(raw: Record<string, unknown>): DomainTransaction {
  return {
    id: String(raw.id ?? ""),
    date: String(raw.date ?? ""),
    year: Number(raw.year ?? 0),
    month: Number(raw.month ?? 0),
    primaryCategory: String(raw.primaryCategory ?? ""),
    secondaryCategory: raw.secondaryCategory != null ? String(raw.secondaryCategory) : null,
    tertiaryCategory: String(raw.tertiaryCategory ?? ""),
    amount: Number(raw.amountCents ?? 0) / 100,
    account: String(raw.account ?? ""),
    type: raw.type === "income" ? "income" : "expense",
    currency: String(raw.currency ?? "CNY"),
    tags: parseTags(raw.tags),
    note: raw.note != null ? String(raw.note) : null,
  };
}

/** Map raw Worker transfer (camelCase from Drizzle) to DomainTransfer */
export function toDomainTransfer(raw: Record<string, unknown>): DomainTransfer {
  return {
    id: String(raw.id ?? ""),
    date: String(raw.date ?? ""),
    year: Number(raw.year ?? 0),
    month: Number(raw.month ?? 0),
    day: Number(raw.day ?? 0),
    primaryCategory: raw.primaryCategory != null ? String(raw.primaryCategory) : null,
    secondaryCategory: raw.secondaryCategory != null ? String(raw.secondaryCategory) : null,
    transactionType: raw.transactionType != null ? String(raw.transactionType) : null,
    inflowAmount: Number(raw.inflowAmountCents ?? 0) / 100,
    outflowAmount: Number(raw.outflowAmountCents ?? 0) / 100,
    currency: String(raw.currency ?? "CNY"),
    account: String(raw.account ?? ""),
    tags: parseTags(raw.tags),
    note: raw.note != null ? String(raw.note) : null,
  };
}

/** Build 12-month MonthlyData array from transactions */
export function buildMonthlyData(transactions: DomainTransaction[]): MonthlyData[] {
  const monthNames = [
    "一月",
    "二月",
    "三月",
    "四月",
    "五月",
    "六月",
    "七月",
    "八月",
    "九月",
    "十月",
    "十一月",
    "十二月",
  ];

  const monthly: MonthlyData[] = monthNames.map((name) => ({
    month: name,
    income: 0,
    expense: 0,
    balance: 0,
  }));

  for (const tx of transactions) {
    const idx = tx.month - 1;
    const entry = monthly[idx];
    if (!entry) continue;
    if (tx.type === "income") {
      entry.income += tx.amount;
    } else {
      entry.expense += tx.amount;
    }
    entry.balance = entry.income - entry.expense;
  }

  return monthly;
}
