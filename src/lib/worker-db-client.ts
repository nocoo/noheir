/**
 * WorkerDbClient — Typed HTTP client for the noheir Cloudflare Worker.
 *
 * Used by Next.js Server Components and Server Actions to query D1 via
 * the Worker's REST API. The Worker runs Drizzle internally — this client
 * sends structured JSON requests, not raw SQL.
 *
 * Architecture: Browser → Next.js (auth) → WorkerDbClient → Worker → D1
 *
 * IMPORTANT: This module must NEVER be imported in client-side code.
 * WORKER_URL and WORKER_TOKEN are server-only env vars.
 */

import type { ExpectedUnitSnapshot } from "@/domain/types";

export class WorkerDbError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
  ) {
    super(message);
    this.name = "WorkerDbError";
  }
}

export class WorkerDbClient {
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(baseUrl: string, secret: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.secret = secret;
  }

  private headers(userId: string): HeadersInit {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.secret}`,
      "X-User-Id": userId,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    userId: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      ...(this.headers(userId) as Record<string, string>),
      ...(extraHeaders ?? {}),
    };
    const init: RequestInit = {
      method,
      headers,
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const res = await fetch(url, init);

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new WorkerDbError(text, res.status, `${method} ${path}`);
    }

    // Some endpoints (DELETE) return 204 with no body. Tolerate that.
    if (res.status === 204) {
      return undefined as T;
    }

    return (await res.json()) as T;
  }

  // ── Health (no auth) ──

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Users ──

  async syncUser(
    userId: string,
    data: {
      email: string;
      name?: string | null;
      image?: string | null;
      providerAccountId: string;
    },
  ) {
    return this.request<{ user: unknown }>("PUT", "/api/users/me", userId, data);
  }

  // ── Transactions ──

  async searchTransactions(userId: string, params: Record<string, unknown> = {}) {
    return this.request<{
      transactions: unknown[];
      total_returned: number;
    }>("POST", "/api/transactions/search", userId, params);
  }

  async getTransaction(userId: string, id: string) {
    return this.request<{ transaction: unknown }>("GET", `/api/transactions/${id}`, userId);
  }

  async createTransaction(userId: string, data: Record<string, unknown>) {
    return this.request<{ transaction: unknown }>("POST", "/api/transactions", userId, data);
  }

  async bulkCreateTransactions(userId: string, rows: Record<string, unknown>[]) {
    return this.request<{ inserted: number }>("POST", "/api/transactions/bulk", userId, { rows });
  }

  async updateTransaction(userId: string, id: string, data: Record<string, unknown>) {
    return this.request<{ transaction: unknown }>("PUT", `/api/transactions/${id}`, userId, data);
  }

  async deleteTransaction(userId: string, id: string) {
    return this.request<{ success: boolean }>("DELETE", `/api/transactions/${id}`, userId);
  }

  async countTransactionsByYear(userId: string, year: number) {
    return this.request<{ count: number }>("GET", `/api/transactions/years/${year}/count`, userId);
  }

  async getAllTransactionsByYear(userId: string, year: number) {
    return this.request<{
      transactions: unknown[];
      total_returned: number;
    }>("GET", `/api/transactions/years/${year}`, userId);
  }

  async deleteTransactionsByYear(userId: string, year: number) {
    return this.request<{ deleted: number }>("DELETE", `/api/transactions/years/${year}`, userId);
  }

  // ── Transfers ──

  async searchTransfers(userId: string, params: Record<string, unknown> = {}) {
    return this.request<{
      transfers: unknown[];
      total_returned: number;
    }>("POST", "/api/transfers/search", userId, params);
  }

  async getTransfer(userId: string, id: string) {
    return this.request<{ transfer: unknown }>("GET", `/api/transfers/${id}`, userId);
  }

  async createTransfer(userId: string, data: Record<string, unknown>) {
    return this.request<{ transfer: unknown }>("POST", "/api/transfers", userId, data);
  }

  async bulkCreateTransfers(userId: string, rows: Record<string, unknown>[]) {
    return this.request<{ inserted: number }>("POST", "/api/transfers/bulk", userId, { rows });
  }

  async updateTransfer(userId: string, id: string, data: Record<string, unknown>) {
    return this.request<{ transfer: unknown }>("PUT", `/api/transfers/${id}`, userId, data);
  }

  async deleteTransfer(userId: string, id: string) {
    return this.request<{ success: boolean }>("DELETE", `/api/transfers/${id}`, userId);
  }

  async countTransfersByYear(userId: string, year: number) {
    return this.request<{ count: number }>("GET", `/api/transfers/years/${year}/count`, userId);
  }

  async getAllTransfersByYear(userId: string, year: number) {
    return this.request<{
      transfers: unknown[];
      total_returned: number;
    }>("GET", `/api/transfers/years/${year}`, userId);
  }

  async deleteTransfersByYear(userId: string, year: number) {
    return this.request<{ deleted: number }>("DELETE", `/api/transfers/years/${year}`, userId);
  }

  // ── Products ──

  async listProducts(
    userId: string,
    filters?: { channel?: string; category?: string; currency?: string; includeArchived?: boolean },
  ) {
    const params = new URLSearchParams();
    if (filters?.channel) params.set("channel", filters.channel);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.currency) params.set("currency", filters.currency);
    if (filters?.includeArchived) params.set("includeArchived", "true");
    const qs = params.toString();
    return this.request<{
      products: unknown[];
      total_returned: number;
    }>("GET", `/api/products${qs ? `?${qs}` : ""}`, userId);
  }

  async getProduct(userId: string, id: string) {
    return this.request<{ product: unknown }>("GET", `/api/products/${id}`, userId);
  }

  async createProduct(userId: string, data: Record<string, unknown>) {
    return this.request<{ product: unknown }>("POST", "/api/products", userId, data);
  }

  async updateProduct(userId: string, id: string, data: Record<string, unknown>) {
    return this.request<{ product: unknown }>("PUT", `/api/products/${id}`, userId, data);
  }

  async deleteProduct(userId: string, id: string) {
    return this.request<{ success: boolean }>("DELETE", `/api/products/${id}`, userId);
  }

  // ── Units ──

  async listUnits(
    userId: string,
    filters?: {
      status?: string;
      strategy?: string;
      tactics?: string;
      currency?: string;
      with_products?: boolean;
    },
  ) {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.strategy) params.set("strategy", filters.strategy);
    if (filters?.tactics) params.set("tactics", filters.tactics);
    if (filters?.currency) params.set("currency", filters.currency);
    if (filters?.with_products) params.set("with_products", "true");
    const qs = params.toString();
    return this.request<{
      units: unknown[];
      total_returned: number;
    }>("GET", `/api/units${qs ? `?${qs}` : ""}`, userId);
  }

  async getUnit(userId: string, id: string) {
    return this.request<{ unit: unknown }>("GET", `/api/units/${id}`, userId);
  }

  async createUnit(userId: string, data: Record<string, unknown>) {
    return this.request<{ unit: unknown }>("POST", "/api/units", userId, data);
  }

  async updateUnit(userId: string, id: string, data: Record<string, unknown>) {
    return this.request<{ unit: unknown }>("PUT", `/api/units/${id}`, userId, data);
  }

  async deleteUnit(userId: string, id: string) {
    return this.request<{ success: boolean }>("DELETE", `/api/units/${id}`, userId);
  }

  // ── Contribution Logs ──

  async searchContributionLogs(
    userId: string,
    params: {
      unitId?: string;
      productId?: string;
      operationType?: string;
      source?: string;
      startDate?: string;
      endDate?: string;
      includeDeleted?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    return this.request<{
      logs: unknown[];
      total: number;
    }>("POST", "/api/contribution-logs/search", userId, params);
  }

  async getContributionLogsSummaryByUnit(userId: string, unitId: string) {
    return this.request<{
      summary: {
        totalInvested: number;
        totalWithdrawn: number;
        netAmount: number;
        totalPnl: number;
        logCount: number;
      };
    }>("GET", `/api/contribution-logs/summary/unit/${unitId}`, userId);
  }

  async getContributionLogsSummaryByProduct(userId: string, productId: string) {
    return this.request<{
      summary: {
        totalInvested: number;
        totalWithdrawn: number;
        netAmount: number;
        totalPnl: number;
        logCount: number;
        unitCount: number;
      };
    }>("GET", `/api/contribution-logs/summary/product/${productId}`, userId);
  }

  async getContributionLog(userId: string, id: string) {
    return this.request<{ log: unknown }>("GET", `/api/contribution-logs/${id}`, userId);
  }

  async createContributionLog(
    userId: string,
    data: {
      unitId: string;
      productId?: string | null;
      productName?: string | null;
      operationType: string;
      amountCents: number;
      balanceAfterCents?: number | null;
      pnlCents?: number | null;
      operationDate: string;
      source?: string;
      note?: string | null;
    },
  ) {
    return this.request<{ log: unknown }>("POST", "/api/contribution-logs", userId, data);
  }

  async updateContributionLog(
    userId: string,
    id: string,
    data: {
      operationType?: string;
      amountCents?: number;
      balanceAfterCents?: number | null;
      pnlCents?: number | null;
      operationDate?: string;
      note?: string | null;
    },
  ) {
    return this.request<{ log: unknown }>("PUT", `/api/contribution-logs/${id}`, userId, data);
  }

  /**
   * Unit timeline + the raw snapshot for optimistic concurrency. Both come from
   * one request so they cannot drift, and so `expected` is never built from a
   * mapped shape. See docs/003 § Decision B.
   */
  async listUnitLogs(userId: string, unitId: string) {
    return this.request<{
      logs: unknown[];
      expected: ExpectedUnitSnapshot;
      currentProductName: string | null;
      availableDate: string | null;
      latestInvestDate: string | null;
    }>("GET", `/api/units/${unitId}/logs`, userId);
  }

  /** Atomic multi-change commit: metadata + staged operations + audit note. */
  async commitUnit(
    userId: string,
    unitId: string,
    data: {
      expected: ExpectedUnitSnapshot;
      metadata?: Record<string, unknown>;
      operations?: Array<Record<string, unknown>>;
      operationDate?: string;
      commitNote?: string | null;
    },
  ) {
    return this.request<{ unit: unknown }>("POST", `/api/units/${unitId}/commit`, userId, data);
  }

  async deleteContributionLog(userId: string, id: string) {
    return this.request<{ success: boolean }>("DELETE", `/api/contribution-logs/${id}`, userId);
  }

  async restoreContributionLog(userId: string, id: string) {
    return this.request<{ log: unknown }>("POST", `/api/contribution-logs/${id}/restore`, userId);
  }

  async seedContributionLogs(userId: string) {
    return this.request<{
      success: boolean;
      created: number;
      skipped: number;
      message: string;
    }>("POST", "/api/contribution-logs/seed", userId);
  }

  // ── Settings ──

  async getSettings(userId: string) {
    return this.request<{ settings: unknown | null }>("GET", "/api/settings", userId);
  }

  async saveSettings(userId: string, data: Record<string, unknown>) {
    return this.request<{ settings: unknown }>("PUT", "/api/settings", userId, data);
  }

  async deleteSettings(userId: string) {
    return this.request<{ success: boolean }>("DELETE", "/api/settings", userId);
  }

  // ── Metadata ──

  async getMetadata(userId: string) {
    return this.request<{
      years: number[];
      accounts: string[];
      categories: string[];
      secondary_categories: string[];
      tertiary_categories: string[];
      currencies: string[];
      tags: string[];
      transaction_count: number;
      transfer_count: number;
    }>("GET", "/api/reports/metadata", userId);
  }

  // ── Reports ──

  async getYearlySummary(userId: string, year: number) {
    return this.request<{
      months: Array<{ month: number; income: number; expense: number; count: number }>;
      totals: { income: number; expense: number; count: number };
    }>("GET", `/api/reports/yearly-summary?year=${year}`, userId);
  }

  async getCategorySummary(userId: string, year: number, month?: number, type?: string) {
    const params = new URLSearchParams({ year: year.toString() });
    if (month) params.set("month", month.toString());
    if (type) params.set("type", type);
    return this.request<{
      categories: Array<{
        primary_category: string;
        secondary_category: string | null;
        tertiary_category: string;
        total: number;
        count: number;
      }>;
    }>("GET", `/api/reports/category-summary?${params}`, userId);
  }

  async getAccountSummary(userId: string, year: number) {
    return this.request<{
      accounts: Array<{
        account: string;
        type: string;
        total: number;
        count: number;
      }>;
    }>("GET", `/api/reports/account-summary?year=${year}`, userId);
  }

  async getFlowSummary(userId: string, year: number) {
    return this.request<{
      account_to_category: Array<{
        type: string;
        account: string;
        primary_category: string;
        total: number;
      }>;
      category_to_subcategory: Array<{
        type: string;
        primary_category: string;
        secondary_category: string | null;
        total: number;
      }>;
    }>("GET", `/api/reports/flow-summary?year=${year}`, userId);
  }

  async getMonthlyReport(userId: string, year: number, month: number, currency?: string) {
    const params = new URLSearchParams({
      year: year.toString(),
      month: month.toString(),
    });
    if (currency) params.set("currency", currency);
    return this.request<{
      total_income: number;
      total_expense: number;
      net_amount: number;
      transaction_count: number;
      transfer_count: number;
      total_transfer_in: number;
      total_transfer_out: number;
      expense_by_category: Array<{ category: string; total: number; count: number }>;
      income_by_category: Array<{ category: string; total: number; count: number }>;
      currencies: string[];
    }>("GET", `/api/reports/monthly-summary?${params}`, userId);
  }

  // ── Backup / Restore ──

  async exportData(userId: string) {
    return this.request<{
      transactions: unknown[];
      transfers: unknown[];
      products: unknown[];
      units: unknown[];
      settings: unknown | null;
      exported_at: string;
    }>("GET", "/api/data/export", userId);
  }

  async importData(userId: string, data: Record<string, unknown>) {
    return this.request<{
      transactions_imported: number;
      transfers_imported: number;
    }>("POST", "/api/data/import", userId, data);
  }

  // ── Expense Categories (002 spec) ──

  async listExpenseCategories(userId: string) {
    return this.request<{ categories: RawExpenseCategory[] }>(
      "GET",
      "/api/expense-categories",
      userId,
    );
  }

  async createExpenseCategory(
    userId: string,
    payload: { name: string; colorToken: string; sortOrder?: number | undefined },
  ) {
    return this.request<{ category: RawExpenseCategory }>(
      "POST",
      "/api/expense-categories",
      userId,
      payload,
    );
  }

  async updateExpenseCategory(
    userId: string,
    id: string,
    payload: {
      name?: string | undefined;
      colorToken?: string | undefined;
      sortOrder?: number | undefined;
    },
  ) {
    return this.request<{ category: RawExpenseCategory }>(
      "PUT",
      `/api/expense-categories/${id}`,
      userId,
      payload,
    );
  }

  async deleteExpenseCategory(userId: string, id: string): Promise<void> {
    await this.request<unknown>("DELETE", `/api/expense-categories/${id}`, userId);
  }

  // ── Recurring Expenses (002 spec) ──

  async listRecurringExpenses(userId: string) {
    return this.request<{ rules: RawRecurringExpense[] }>("GET", "/api/recurring-expenses", userId);
  }

  async createRecurringExpense(userId: string, payload: RecurringExpenseCreatePayload) {
    return this.request<{ rule: RawRecurringExpense }>(
      "POST",
      "/api/recurring-expenses",
      userId,
      payload,
    );
  }

  /** PUT /api/recurring-expenses/:id.
   *
   *  By default the request omits the `X-Internal-Action: 1` header so
   *  the Worker silently drops `status` and `endedAt` from the body
   *  (P1-C6 contract). The state-machine actions pass `internal: true`
   *  to unlock those fields; CRUD actions never set this flag. */
  async updateRecurringExpense(
    userId: string,
    id: string,
    payload: RecurringExpenseUpdatePayload,
    opts?: { internal?: boolean },
  ) {
    const headers = opts?.internal ? { "X-Internal-Action": "1" } : undefined;
    return this.request<{ rule: RawRecurringExpense }>(
      "PUT",
      `/api/recurring-expenses/${id}`,
      userId,
      payload,
      headers,
    );
  }

  async deleteRecurringExpense(userId: string, id: string): Promise<void> {
    await this.request<unknown>("DELETE", `/api/recurring-expenses/${id}`, userId);
  }
}

// ── 002-spec wire shapes (exported for action / mapper consumption) ──

export interface RawExpenseCategory {
  id: string;
  userId: string;
  name: string;
  colorToken: string;
  sortOrder: number;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
}

export interface RawRecurringExpense {
  id: string;
  userId: string;
  name: string;
  categoryId: string | null;
  categoryName?: string | null;
  colorToken?: string | null;
  amountCents: number;
  currency: string;
  account: string | null;
  frequency: string;
  interval: number;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  weekday: number | null;
  startDate: string;
  endDate: string | null;
  status: string;
  endedAt: string | null;
  note: string | null;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
}

/** POST body for recurring-expenses. `status` / `endedAt` deliberately
 *  excluded — only the state-machine internal channel writes them. */
export interface RecurringExpenseCreatePayload {
  name: string;
  categoryId?: string | null | undefined;
  amountCents: number;
  currency?: string | undefined;
  account?: string | null | undefined;
  frequency: string;
  interval?: number | undefined;
  dayOfMonth?: number | null | undefined;
  monthOfYear?: number | null | undefined;
  weekday?: number | null | undefined;
  startDate: string;
  endDate?: string | null | undefined;
  note?: string | null | undefined;
}

/** PUT body for recurring-expenses. Every CRUD field is optional and
 *  may be explicitly undefined; status/endedAt go through the
 *  separate state-update payload below. */
export interface RecurringExpenseUpdateBodyPayload {
  name?: string | undefined;
  categoryId?: string | null | undefined;
  amountCents?: number | undefined;
  currency?: string | undefined;
  account?: string | null | undefined;
  frequency?: string | undefined;
  interval?: number | undefined;
  dayOfMonth?: number | null | undefined;
  monthOfYear?: number | null | undefined;
  weekday?: number | null | undefined;
  startDate?: string | undefined;
  endDate?: string | null | undefined;
  note?: string | null | undefined;
}

export type RecurringExpenseUpdatePayload =
  | RecurringExpenseUpdateBodyPayload
  | RecurringExpenseStateUpdatePayload;

/** State-machine PUT body — only used with `internal: true` so the
 *  Worker accepts these fields. */
export interface RecurringExpenseStateUpdatePayload {
  status?: "active" | "paused" | "ended";
  endedAt?: string | null;
}
