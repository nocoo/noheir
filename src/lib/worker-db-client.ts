/**
 * Browser API client for the noheir backend.
 *
 * Same-origin browser API: requests go directly to /api/* with standard cookies/credentials.
 * No secret/baseURL/userId parameters or X-User-Id/internal authority headers.
 * Authentication is provided by Cloudflare Access session cookies / assertion.
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
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const init: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const res = await fetch(path, init);

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new WorkerDbError(text, res.status, `${method} ${path}`);
    }

    // Some endpoints (DELETE) return 204 with no body.
    if (res.status === 204) {
      return undefined as T;
    }

    return (await res.json()) as T;
  }

  // ── Auth (Access Session) ──

  async getMe(): Promise<{
    user: { id: string; email: string; name?: string | null; image?: string | null };
  }> {
    return this.request("GET", "/api/auth/me");
  }

  // ── Health ──

  async health(): Promise<boolean> {
    try {
      const res = await fetch("/api/live");
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Users ──

  async syncUser(data: {
    email: string;
    name?: string | null;
    image?: string | null;
    providerAccountId: string;
  }) {
    return this.request<{ user: unknown }>("PUT", "/api/users/me", data);
  }

  // ── Transactions ──

  async searchTransactions(params: Record<string, unknown> = {}) {
    return this.request<{
      transactions: unknown[];
      total_returned: number;
    }>("POST", "/api/transactions/search", params);
  }

  async getTransaction(id: string) {
    return this.request<{ transaction: unknown }>("GET", `/api/transactions/${id}`);
  }

  async createTransaction(data: Record<string, unknown>) {
    return this.request<{ transaction: unknown }>("POST", "/api/transactions", data);
  }

  async bulkCreateTransactions(rows: Record<string, unknown>[]) {
    return this.request<{ inserted: number }>("POST", "/api/transactions/bulk", { rows });
  }

  async updateTransaction(id: string, data: Record<string, unknown>) {
    return this.request<{ transaction: unknown }>("PUT", `/api/transactions/${id}`, data);
  }

  async deleteTransaction(id: string) {
    return this.request<{ success: boolean }>("DELETE", `/api/transactions/${id}`);
  }

  async countTransactionsByYear(year: number) {
    return this.request<{ count: number }>("GET", `/api/transactions/years/${year}/count`);
  }

  async getAllTransactionsByYear(year: number) {
    return this.request<{
      transactions: unknown[];
      total_returned: number;
    }>("GET", `/api/transactions/years/${year}`);
  }

  async deleteTransactionsByYear(year: number) {
    return this.request<{ deleted: number }>("DELETE", `/api/transactions/years/${year}`);
  }

  /** Atomic import replacing all transactions for the given year */
  async importTransactions(year: number, rows: Record<string, unknown>[]) {
    return this.request<{ imported: number }>("POST", "/api/transactions/import", { year, rows });
  }

  // ── Transfers ──

  async searchTransfers(params: Record<string, unknown> = {}) {
    return this.request<{
      transfers: unknown[];
      total_returned: number;
    }>("POST", "/api/transfers/search", params);
  }

  async getTransfer(id: string) {
    return this.request<{ transfer: unknown }>("GET", `/api/transfers/${id}`);
  }

  async createTransfer(data: Record<string, unknown>) {
    return this.request<{ transfer: unknown }>("POST", "/api/transfers", data);
  }

  async bulkCreateTransfers(rows: Record<string, unknown>[]) {
    return this.request<{ inserted: number }>("POST", "/api/transfers/bulk", { rows });
  }

  async updateTransfer(id: string, data: Record<string, unknown>) {
    return this.request<{ transfer: unknown }>("PUT", `/api/transfers/${id}`, data);
  }

  async deleteTransfer(id: string) {
    return this.request<{ success: boolean }>("DELETE", `/api/transfers/${id}`);
  }

  async countTransfersByYear(year: number) {
    return this.request<{ count: number }>("GET", `/api/transfers/years/${year}/count`);
  }

  async getAllTransfersByYear(year: number) {
    return this.request<{
      transfers: unknown[];
      total_returned: number;
    }>("GET", `/api/transfers/years/${year}`);
  }

  async deleteTransfersByYear(year: number) {
    return this.request<{ deleted: number }>("DELETE", `/api/transfers/years/${year}`);
  }

  /** Atomic import replacing all transfers for the given year */
  async importTransfers(year: number, rows: Record<string, unknown>[]) {
    return this.request<{ imported: number }>("POST", "/api/transfers/import", { year, rows });
  }

  // ── Products ──

  async listProducts(filters?: {
    channel?: string;
    category?: string;
    currency?: string;
    includeArchived?: boolean;
  }) {
    const params = new URLSearchParams();
    if (filters?.channel) params.set("channel", filters.channel);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.currency) params.set("currency", filters.currency);
    if (filters?.includeArchived) params.set("includeArchived", "true");
    const qs = params.toString();
    return this.request<{
      products: unknown[];
      total_returned: number;
    }>("GET", `/api/products${qs ? `?${qs}` : ""}`);
  }

  async getProduct(id: string) {
    return this.request<{ product: unknown }>("GET", `/api/products/${id}`);
  }

  async createProduct(data: Record<string, unknown>) {
    return this.request<{ product: unknown }>("POST", "/api/products", data);
  }

  async updateProduct(id: string, data: Record<string, unknown>) {
    return this.request<{ product: unknown }>("PUT", `/api/products/${id}`, data);
  }

  async deleteProduct(id: string) {
    return this.request<{ success: boolean }>("DELETE", `/api/products/${id}`);
  }

  // ── Units ──

  async listUnits(filters?: {
    status?: string;
    strategy?: string;
    tactics?: string;
    currency?: string;
    with_products?: boolean;
  }) {
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
    }>("GET", `/api/units${qs ? `?${qs}` : ""}`);
  }

  async getUnit(id: string) {
    return this.request<{ unit: unknown }>("GET", `/api/units/${id}`);
  }

  async createUnit(data: Record<string, unknown>) {
    return this.request<{ unit: unknown }>("POST", "/api/units", data);
  }

  async updateUnit(id: string, data: Record<string, unknown>) {
    return this.request<{ unit: unknown }>("PUT", `/api/units/${id}`, data);
  }

  async deleteUnit(id: string) {
    return this.request<{ success: boolean }>("DELETE", `/api/units/${id}`);
  }

  // ── Contribution Logs ──

  async searchContributionLogs(
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
    }>("POST", "/api/contribution-logs/search", params);
  }

  async getContributionLogsSummaryByUnit(unitId: string) {
    return this.request<{
      summary: {
        totalInvested: number;
        totalWithdrawn: number;
        netAmount: number;
        totalPnl: number;
        logCount: number;
      };
    }>("GET", `/api/contribution-logs/summary/unit/${unitId}`);
  }

  async getContributionLogsSummaryByProduct(productId: string) {
    return this.request<{
      summary: {
        totalInvested: number;
        totalWithdrawn: number;
        netAmount: number;
        totalPnl: number;
        logCount: number;
        unitCount: number;
      };
    }>("GET", `/api/contribution-logs/summary/product/${productId}`);
  }

  async getContributionLog(id: string) {
    return this.request<{ log: unknown }>("GET", `/api/contribution-logs/${id}`);
  }

  async createContributionLog(data: {
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
  }) {
    return this.request<{ log: unknown }>("POST", "/api/contribution-logs", data);
  }

  async updateContributionLog(
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
    return this.request<{ log: unknown }>("PUT", `/api/contribution-logs/${id}`, data);
  }

  async listUnitLogs(unitId: string) {
    return this.request<{
      logs: unknown[];
      expected: ExpectedUnitSnapshot;
      currentProductName: string | null;
      availableDate: string | null;
      latestInvestDate: string | null;
    }>("GET", `/api/units/${unitId}/logs`);
  }

  async commitUnit(
    unitId: string,
    data: {
      expected: ExpectedUnitSnapshot;
      metadata?: Record<string, unknown>;
      operations?: Array<Record<string, unknown>>;
      operationDate?: string;
      commitNote?: string | null;
    },
  ) {
    return this.request<{ unit: unknown }>("POST", `/api/units/${unitId}/commit`, data);
  }

  async deleteContributionLog(id: string) {
    return this.request<{ success: boolean }>("DELETE", `/api/contribution-logs/${id}`);
  }

  async restoreContributionLog(id: string) {
    return this.request<{ log: unknown }>("POST", `/api/contribution-logs/${id}/restore`);
  }

  async seedContributionLogs() {
    return this.request<{
      success: boolean;
      created: number;
      skipped: number;
      message: string;
    }>("POST", "/api/contribution-logs/seed");
  }

  // ── Settings ──

  async getSettings() {
    return this.request<{ settings: unknown | null }>("GET", "/api/settings");
  }

  async saveSettings(data: Record<string, unknown>) {
    return this.request<{ settings: unknown }>("PUT", "/api/settings", data);
  }

  async deleteSettings() {
    return this.request<{ success: boolean }>("DELETE", "/api/settings");
  }

  // ── Metadata ──

  async getMetadata() {
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
    }>("GET", "/api/reports/metadata");
  }

  // ── Reports ──

  async getYearlySummary(year: number) {
    return this.request<{
      months: Array<{ month: number; income: number; expense: number; count: number }>;
      totals: { income: number; expense: number; count: number };
    }>("GET", `/api/reports/yearly-summary?year=${year}`);
  }

  async getCategorySummary(year: number, month?: number, type?: string) {
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
    }>("GET", `/api/reports/category-summary?${params}`);
  }

  async getAccountSummary(year: number) {
    return this.request<{
      accounts: Array<{
        account: string;
        type: string;
        total: number;
        count: number;
      }>;
    }>("GET", `/api/reports/account-summary?year=${year}`);
  }

  async getFlowSummary(year: number) {
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
    }>("GET", `/api/reports/flow-summary?year=${year}`);
  }

  async getMonthlyReport(year: number, month: number, currency?: string) {
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
    }>("GET", `/api/reports/monthly-summary?${params}`);
  }

  // ── Backup / Restore ──

  async exportData() {
    return this.request<{
      transactions: unknown[];
      transfers: unknown[];
      products: unknown[];
      units: unknown[];
      settings: unknown | null;
      exported_at: string;
    }>("GET", "/api/data/export");
  }

  async importData(data: Record<string, unknown>) {
    return this.request<{
      transactions_imported: number;
      transfers_imported: number;
    }>("POST", "/api/data/import", data);
  }

  // ── Expense Categories (002 spec) ──

  async listExpenseCategories() {
    return this.request<{ categories: RawExpenseCategory[] }>("GET", "/api/expense-categories");
  }

  async createExpenseCategory(payload: {
    name: string;
    colorToken: string;
    sortOrder?: number | undefined;
  }) {
    return this.request<{ category: RawExpenseCategory }>(
      "POST",
      "/api/expense-categories",
      payload,
    );
  }

  async updateExpenseCategory(
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
      payload,
    );
  }

  async deleteExpenseCategory(id: string): Promise<void> {
    await this.request<unknown>("DELETE", `/api/expense-categories/${id}`);
  }

  // ── Recurring Expenses (002 spec) ──

  async listRecurringExpenses() {
    return this.request<{ rules: RawRecurringExpense[] }>("GET", "/api/recurring-expenses");
  }

  async createRecurringExpense(payload: RecurringExpenseCreatePayload) {
    return this.request<{ rule: RawRecurringExpense }>("POST", "/api/recurring-expenses", payload);
  }

  async updateRecurringExpense(id: string, payload: RecurringExpenseUpdatePayload) {
    return this.request<{ rule: RawRecurringExpense }>(
      "PUT",
      `/api/recurring-expenses/${id}`,
      payload,
    );
  }

  /**
   * Transition recurring expense state via backend endpoint.
   * Browser sends transition intent; backend validates ownership and state machine.
   */
  async transitionRecurringExpense(id: string, transition: "pause" | "resume" | "end") {
    return this.request<{ success: boolean }>("POST", `/api/recurring-expenses/${id}/state`, {
      transition,
    });
  }

  async deleteRecurringExpense(id: string): Promise<void> {
    await this.request<unknown>("DELETE", `/api/recurring-expenses/${id}`);
  }
}

export const workerDbClient = new WorkerDbClient();

// ── Wire shapes ──

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

export interface RecurringExpenseUpdatePayload {
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
