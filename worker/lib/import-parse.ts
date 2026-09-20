import { importTransactionRowSchema, importTransferRowSchema } from "../db/validation";
import type { NormalizedTransactionRow, NormalizedTransferRow } from "./year-import";

export function parseTransactionImportRow(
  row: unknown,
  index: number,
): { ok: true; row: NormalizedTransactionRow } | { ok: false; message: string } {
  const parsed = importTransactionRowSchema.safeParse(row);
  if (!parsed.success) {
    return { ok: false, message: `row ${index}: ${parsed.error.message}` };
  }
  const d = parsed.data;
  return {
    ok: true,
    row: {
      id: crypto.randomUUID(),
      date: d.date,
      year: d.year,
      month: d.month,
      day: d.day,
      primaryCategory: d.primaryCategory,
      secondaryCategory: d.secondaryCategory ?? null,
      tertiaryCategory: d.tertiaryCategory,
      amountCents: d.amountCents,
      type: d.type,
      account: d.account,
      currency: d.currency ?? "人民币",
      tags: d.tags ?? "[]",
      note: d.note ?? null,
      rawIndex: d.rawIndex ?? null,
      hasSecondaryMapping: d.hasSecondaryMapping === false ? 0 : 1,
    },
  };
}

export function parseTransferImportRow(
  row: unknown,
  index: number,
): { ok: true; row: NormalizedTransferRow } | { ok: false; message: string } {
  const parsed = importTransferRowSchema.safeParse(row);
  if (!parsed.success) {
    return { ok: false, message: `row ${index}: ${parsed.error.message}` };
  }
  const d = parsed.data;
  return {
    ok: true,
    row: {
      id: crypto.randomUUID(),
      date: d.date,
      year: d.year,
      month: d.month,
      day: d.day,
      primaryCategory: d.primaryCategory ?? null,
      secondaryCategory: d.secondaryCategory ?? "转账",
      transactionType: d.transactionType ?? null,
      inflowAmountCents: d.inflowAmountCents ?? 0,
      outflowAmountCents: d.outflowAmountCents ?? 0,
      currency: d.currency ?? "人民币",
      account: d.account,
      tags: d.tags ?? "[]",
      note: d.note ?? null,
      rawIndex: d.rawIndex ?? null,
    },
  };
}
