import type { DomainTransaction, MonthlyData } from "@/domain/types"

/** Map raw Worker transaction (snake_case, amount_cents) to DomainTransaction */
export function toDomainTransaction(
  raw: Record<string, unknown>,
): DomainTransaction {
  return {
    id: String(raw.id ?? ""),
    date: String(raw.date ?? ""),
    year: Number(raw.year ?? 0),
    month: Number(raw.month ?? 0),
    primaryCategory: String(raw.primary_category ?? ""),
    secondaryCategory:
      raw.secondary_category != null
        ? String(raw.secondary_category)
        : null,
    tertiaryCategory: String(raw.tertiary_category ?? ""),
    amount: Number(raw.amount_cents ?? 0) / 100,
    account: String(raw.account ?? ""),
    type: raw.type === "income" ? "income" : "expense",
    currency: String(raw.currency ?? "CNY"),
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    note: raw.note != null ? String(raw.note) : null,
  }
}

/** Build 12-month MonthlyData array from transactions */
export function buildMonthlyData(
  transactions: DomainTransaction[],
): MonthlyData[] {
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
  ]

  const monthly: MonthlyData[] = monthNames.map((name) => ({
    month: name,
    income: 0,
    expense: 0,
    balance: 0,
  }))

  for (const tx of transactions) {
    const idx = tx.month - 1
    const entry = monthly[idx]
    if (!entry) continue
    if (tx.type === "income") {
      entry.income += tx.amount
    } else {
      entry.expense += tx.amount
    }
    entry.balance = entry.income - entry.expense
  }

  return monthly
}
