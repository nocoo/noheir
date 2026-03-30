import { eq, and, sql, desc } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { transactions, transfers } from "../schema";
import type { MonthlyReport, CategoryBreakdown } from "../types";

/**
 * Monthly report repository matching the behavioral contract of
 * get_monthly_report RPC.
 *
 * Returns income/expense totals, net amount, transfer flows,
 * category breakdowns, and distinct currencies for a given year+month.
 */
export function createReportsRepo(db: DrizzleD1Database) {
  return {
    async monthly(
      userId: string,
      year: number,
      month: number,
      currency?: string,
    ): Promise<MonthlyReport> {
      // Build common conditions
      const txBaseConditions = [
        eq(transactions.userId, userId),
        eq(transactions.year, year),
        eq(transactions.month, month),
      ];
      const trBaseConditions = [
        eq(transfers.userId, userId),
        eq(transfers.year, year),
        eq(transfers.month, month),
      ];

      if (currency) {
        txBaseConditions.push(eq(transactions.currency, currency));
        trBaseConditions.push(eq(transfers.currency, currency));
      }

      const txWhere = and(...txBaseConditions);
      const trWhere = and(...trBaseConditions);

      // Run all queries in parallel
      const [
        incomeTotals,
        expenseTotals,
        txCount,
        trCount,
        transferTotals,
        expenseByCategory,
        incomeByCategory,
        txCurrencies,
        trCurrencies,
      ] = await Promise.all([
        // total_income: SUM(amountCents) WHERE type='income'
        db.select({
          total: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)`,
        })
          .from(transactions)
          .where(and(txWhere, eq(transactions.type, "income")))
          .get(),

        // total_expense: SUM(amountCents) WHERE type='expense'
        db.select({
          total: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)`,
        })
          .from(transactions)
          .where(and(txWhere, eq(transactions.type, "expense")))
          .get(),

        // transaction_count
        db.select({ count: sql<number>`count(*)` })
          .from(transactions)
          .where(txWhere)
          .get(),

        // transfer_count
        db.select({ count: sql<number>`count(*)` })
          .from(transfers)
          .where(trWhere)
          .get(),

        // total_transfer_in / total_transfer_out
        db.select({
          total_in: sql<number>`COALESCE(SUM(${transfers.inflowAmountCents}), 0)`,
          total_out: sql<number>`COALESCE(SUM(${transfers.outflowAmountCents}), 0)`,
        })
          .from(transfers)
          .where(trWhere)
          .get(),

        // expense_by_category: GROUP BY primary_category ORDER BY total DESC
        db.select({
          category: transactions.primaryCategory,
          total: sql<number>`SUM(${transactions.amountCents})`,
          count: sql<number>`count(*)`,
        })
          .from(transactions)
          .where(and(txWhere, eq(transactions.type, "expense")))
          .groupBy(transactions.primaryCategory)
          .orderBy(desc(sql`SUM(${transactions.amountCents})`))
          .all(),

        // income_by_category: GROUP BY primary_category ORDER BY total DESC
        db.select({
          category: transactions.primaryCategory,
          total: sql<number>`SUM(${transactions.amountCents})`,
          count: sql<number>`count(*)`,
        })
          .from(transactions)
          .where(and(txWhere, eq(transactions.type, "income")))
          .groupBy(transactions.primaryCategory)
          .orderBy(desc(sql`SUM(${transactions.amountCents})`))
          .all(),

        // currencies from transactions
        db.selectDistinct({ value: transactions.currency })
          .from(transactions)
          .where(txWhere)
          .all(),

        // currencies from transfers
        db.selectDistinct({ value: transfers.currency })
          .from(transfers)
          .where(trWhere)
          .all(),
      ]);

      const totalIncome = incomeTotals?.total ?? 0;
      const totalExpense = expenseTotals?.total ?? 0;

      // net_amount = income - expense (matching SUM(CASE) logic from RPC)
      const netAmount = totalIncome - totalExpense;

      // Merge currencies (UNION DISTINCT)
      const currencies = [...new Set([
        ...txCurrencies.map((r) => r.value),
        ...trCurrencies.map((r) => r.value),
      ])].sort();

      // Map category breakdowns
      const mapBreakdown = (
        rows: { category: string; total: number; count: number }[],
      ): CategoryBreakdown[] =>
        rows.map((r) => ({
          category: r.category,
          total: r.total,
          count: r.count,
        }));

      return {
        total_income: totalIncome,
        total_expense: totalExpense,
        net_amount: netAmount,
        transaction_count: txCount?.count ?? 0,
        transfer_count: trCount?.count ?? 0,
        total_transfer_in: transferTotals?.total_in ?? 0,
        total_transfer_out: transferTotals?.total_out ?? 0,
        expense_by_category: mapBreakdown(expenseByCategory),
        income_by_category: mapBreakdown(incomeByCategory),
        currencies,
      };
    },
  };
}

export type ReportsRepo = ReturnType<typeof createReportsRepo>;
