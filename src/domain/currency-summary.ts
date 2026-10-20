export function sumCurrency(
  rows: ReadonlyArray<{ currency: string; amount: number }>,
  currency = "CNY",
): number {
  return rows.reduce((total, row) => total + (row.currency === currency ? row.amount : 0), 0);
}
