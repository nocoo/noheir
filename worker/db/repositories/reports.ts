import { eq, and, sql, desc } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { transactions, transfers } from "../schema";
import type {
  MonthlyReport,
  CategoryBreakdown,
  YearlySummary,
  YearlySummaryMonth,
  CategorySummaryResponse,
  CategorySummaryRow,
  AccountSummaryResponse,
  AccountSummaryRow,
  FlowSummaryResponse,
  FlowAccountCategoryRow,
  FlowCategoryRow,
} from "../types";

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

    /**
     * Yearly summary: monthly income/expense/count + year totals.
     * Single SQL using CASE expressions for income/expense split.
     */
    async yearlySummary(
      userId: string,
      year: number,
    ): Promise<YearlySummary> {
      const rows = await db
        .select({
          month: transactions.month,
          income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
          expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.year, year)))
        .groupBy(transactions.month)
        .orderBy(transactions.month)
        .all();

      // Build 12-month array (fill missing months with zeros)
      const monthMap = new Map<number, YearlySummaryMonth>();
      for (const row of rows) {
        monthMap.set(row.month, {
          month: row.month,
          income: row.income,
          expense: row.expense,
          count: row.count,
        });
      }

      const months: YearlySummaryMonth[] = [];
      let totalIncome = 0;
      let totalExpense = 0;
      let totalCount = 0;

      for (let m = 1; m <= 12; m++) {
        const entry = monthMap.get(m) ?? { month: m, income: 0, expense: 0, count: 0 };
        months.push(entry);
        totalIncome += entry.income;
        totalExpense += entry.expense;
        totalCount += entry.count;
      }

      return {
        months,
        totals: { income: totalIncome, expense: totalExpense, count: totalCount },
      };
    },

    /**
     * Category summary: SUM/COUNT grouped by (primary, secondary, tertiary).
     * Filtered by year and optionally by type (income/expense).
     */
    async categorySummary(
      userId: string,
      year: number,
      type?: string,
    ): Promise<CategorySummaryResponse> {
      const conditions = [
        eq(transactions.userId, userId),
        eq(transactions.year, year),
      ];
      if (type) {
        conditions.push(eq(transactions.type, type));
      }

      const rows = await db
        .select({
          primary_category: transactions.primaryCategory,
          secondary_category: transactions.secondaryCategory,
          tertiary_category: transactions.tertiaryCategory,
          total: sql<number>`SUM(${transactions.amountCents})`,
          count: sql<number>`count(*)`,
        })
        .from(transactions)
        .where(and(...conditions))
        .groupBy(
          transactions.primaryCategory,
          transactions.secondaryCategory,
          transactions.tertiaryCategory,
        )
        .orderBy(desc(sql`SUM(${transactions.amountCents})`))
        .all();

      const categories: CategorySummaryRow[] = rows.map((r) => ({
        primary_category: r.primary_category,
        secondary_category: r.secondary_category,
        tertiary_category: r.tertiary_category,
        total: r.total,
        count: r.count,
      }));

      return { categories };
    },

    /**
     * Account summary: SUM/COUNT grouped by (account, type).
     */
    async accountSummary(
      userId: string,
      year: number,
    ): Promise<AccountSummaryResponse> {
      const rows = await db
        .select({
          account: transactions.account,
          type: transactions.type,
          total: sql<number>`SUM(${transactions.amountCents})`,
          count: sql<number>`count(*)`,
        })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.year, year)))
        .groupBy(transactions.account, transactions.type)
        .orderBy(desc(sql`SUM(${transactions.amountCents})`))
        .all();

      const accounts: AccountSummaryRow[] = rows.map((r) => ({
        account: r.account,
        type: r.type,
        total: r.total,
        count: r.count,
      }));

      return { accounts };
    },

    /**
     * Flow summary: two aggregations for Sankey-style flow data.
     * 1. account → primaryCategory (grouped by type, account, primary_category)
     * 2. primaryCategory → secondaryCategory (grouped by type, primary_category, secondary_category)
     */
    async flowSummary(
      userId: string,
      year: number,
    ): Promise<FlowSummaryResponse> {
      const baseConditions = and(
        eq(transactions.userId, userId),
        eq(transactions.year, year),
      );

      const [accountToCategoryRows, categoryToSubRows] = await Promise.all([
        db
          .select({
            type: transactions.type,
            account: transactions.account,
            primary_category: transactions.primaryCategory,
            total: sql<number>`SUM(${transactions.amountCents})`,
          })
          .from(transactions)
          .where(baseConditions)
          .groupBy(
            transactions.type,
            transactions.account,
            transactions.primaryCategory,
          )
          .orderBy(desc(sql`SUM(${transactions.amountCents})`))
          .all(),

        db
          .select({
            type: transactions.type,
            primary_category: transactions.primaryCategory,
            secondary_category: transactions.secondaryCategory,
            total: sql<number>`SUM(${transactions.amountCents})`,
          })
          .from(transactions)
          .where(baseConditions)
          .groupBy(
            transactions.type,
            transactions.primaryCategory,
            transactions.secondaryCategory,
          )
          .orderBy(desc(sql`SUM(${transactions.amountCents})`))
          .all(),
      ]);

      const account_to_category: FlowAccountCategoryRow[] =
        accountToCategoryRows.map((r) => ({
          type: r.type,
          account: r.account,
          primary_category: r.primary_category,
          total: r.total,
        }));

      const category_to_subcategory: FlowCategoryRow[] =
        categoryToSubRows.map((r) => ({
          type: r.type,
          primary_category: r.primary_category,
          secondary_category: r.secondary_category,
          total: r.total,
        }));

      return { account_to_category, category_to_subcategory };
    },
  };
}

export type ReportsRepo = ReturnType<typeof createReportsRepo>;
