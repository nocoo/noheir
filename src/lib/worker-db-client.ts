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

export type TargetDb = "production" | "test";

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
  private readonly targetDb: TargetDb;

  constructor(baseUrl: string, secret: string, targetDb: TargetDb = "production") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.secret = secret;
    this.targetDb = targetDb;
  }

  private headers(userId: string): HeadersInit {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.secret}`,
      "X-User-Id": userId,
      "X-Target-DB": this.targetDb,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    userId: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: this.headers(userId),
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const res = await fetch(url, init);

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new WorkerDbError(text, res.status, `${method} ${path}`);
    }

    return (await res.json()) as T;
  }

  // ── Health (no auth) ──

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/live`);
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Users ──

  async syncUser(userId: string, data: {
    email: string;
    name?: string | null;
    image?: string | null;
    providerAccountId: string;
  }) {
    return this.request<{ user: unknown }>(
      "PUT", "/api/users/me", userId, data,
    );
  }

  // ── Transactions ──

  async searchTransactions(userId: string, params: Record<string, unknown> = {}) {
    return this.request<{
      transactions: unknown[];
      total_returned: number;
    }>("POST", "/api/transactions/search", userId, params);
  }

  async getTransaction(userId: string, id: string) {
    return this.request<{ transaction: unknown }>(
      "GET", `/api/transactions/${id}`, userId,
    );
  }

  async createTransaction(userId: string, data: Record<string, unknown>) {
    return this.request<{ transaction: unknown }>(
      "POST", "/api/transactions", userId, data,
    );
  }

  async bulkCreateTransactions(userId: string, rows: Record<string, unknown>[]) {
    return this.request<{ inserted: number }>(
      "POST", "/api/transactions/bulk", userId, { rows },
    );
  }

  async updateTransaction(userId: string, id: string, data: Record<string, unknown>) {
    return this.request<{ transaction: unknown }>(
      "PUT", `/api/transactions/${id}`, userId, data,
    );
  }

  async deleteTransaction(userId: string, id: string) {
    return this.request<{ success: boolean }>(
      "DELETE", `/api/transactions/${id}`, userId,
    );
  }

  async countTransactionsByYear(userId: string, year: number) {
    return this.request<{ count: number }>(
      "GET", `/api/transactions/count-by-year?year=${year}`, userId,
    );
  }

  async deleteTransactionsByYear(userId: string, year: number) {
    return this.request<{ deleted: number }>(
      "DELETE", `/api/transactions/by-year?year=${year}`, userId,
    );
  }

  // ── Transfers ──

  async searchTransfers(userId: string, params: Record<string, unknown> = {}) {
    return this.request<{
      transfers: unknown[];
      total_returned: number;
    }>("POST", "/api/transfers/search", userId, params);
  }

  async getTransfer(userId: string, id: string) {
    return this.request<{ transfer: unknown }>(
      "GET", `/api/transfers/${id}`, userId,
    );
  }

  async createTransfer(userId: string, data: Record<string, unknown>) {
    return this.request<{ transfer: unknown }>(
      "POST", "/api/transfers", userId, data,
    );
  }

  async bulkCreateTransfers(userId: string, rows: Record<string, unknown>[]) {
    return this.request<{ inserted: number }>(
      "POST", "/api/transfers/bulk", userId, { rows },
    );
  }

  async updateTransfer(userId: string, id: string, data: Record<string, unknown>) {
    return this.request<{ transfer: unknown }>(
      "PUT", `/api/transfers/${id}`, userId, data,
    );
  }

  async deleteTransfer(userId: string, id: string) {
    return this.request<{ success: boolean }>(
      "DELETE", `/api/transfers/${id}`, userId,
    );
  }

  async countTransfersByYear(userId: string, year: number) {
    return this.request<{ count: number }>(
      "GET", `/api/transfers/count-by-year?year=${year}`, userId,
    );
  }

  async deleteTransfersByYear(userId: string, year: number) {
    return this.request<{ deleted: number }>(
      "DELETE", `/api/transfers/by-year?year=${year}`, userId,
    );
  }

  // ── Products ──

  async listProducts(userId: string, filters?: { channel?: string; category?: string; currency?: string }) {
    const params = new URLSearchParams();
    if (filters?.channel) params.set("channel", filters.channel);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.currency) params.set("currency", filters.currency);
    const qs = params.toString();
    return this.request<{
      products: unknown[];
      total_returned: number;
    }>("GET", `/api/products${qs ? `?${qs}` : ""}`, userId);
  }

  async getProduct(userId: string, id: string) {
    return this.request<{ product: unknown }>(
      "GET", `/api/products/${id}`, userId,
    );
  }

  async createProduct(userId: string, data: Record<string, unknown>) {
    return this.request<{ product: unknown }>(
      "POST", "/api/products", userId, data,
    );
  }

  async updateProduct(userId: string, id: string, data: Record<string, unknown>) {
    return this.request<{ product: unknown }>(
      "PUT", `/api/products/${id}`, userId, data,
    );
  }

  async deleteProduct(userId: string, id: string) {
    return this.request<{ success: boolean }>(
      "DELETE", `/api/products/${id}`, userId,
    );
  }

  // ── Units ──

  async listUnits(userId: string, filters?: {
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
    }>("GET", `/api/units${qs ? `?${qs}` : ""}`, userId);
  }

  async getUnit(userId: string, id: string) {
    return this.request<{ unit: unknown }>(
      "GET", `/api/units/${id}`, userId,
    );
  }

  async createUnit(userId: string, data: Record<string, unknown>) {
    return this.request<{ unit: unknown }>(
      "POST", "/api/units", userId, data,
    );
  }

  async updateUnit(userId: string, id: string, data: Record<string, unknown>) {
    return this.request<{ unit: unknown }>(
      "PUT", `/api/units/${id}`, userId, data,
    );
  }

  async deleteUnit(userId: string, id: string) {
    return this.request<{ success: boolean }>(
      "DELETE", `/api/units/${id}`, userId,
    );
  }

  // ── Settings ──

  async getSettings(userId: string) {
    return this.request<{ settings: unknown | null }>(
      "GET", "/api/settings", userId,
    );
  }

  async upsertSettings(userId: string, data: Record<string, unknown>) {
    return this.request<{ settings: unknown }>(
      "PUT", "/api/settings", userId, data,
    );
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

  async getCategorySummary(userId: string, year: number, type?: string) {
    const params = new URLSearchParams({ year: year.toString() });
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
}
