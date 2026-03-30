/**
 * Lightweight HTTP client for the NoHeir Cloudflare Worker API.
 *
 * Used by the MCP server to query D1 data through the same Worker
 * that the Next.js app uses. Auth via Bearer token + user ID header.
 */

export class WorkerClient {
  private baseUrl: string
  private token: string
  private userId: string

  constructor(baseUrl: string, token: string, userId: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
    this.token = token
    this.userId = userId
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${this.token}`,
      "X-User-Id": this.userId,
      "Content-Type": "application/json",
    }

    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Worker API ${method} ${path}: ${res.status} — ${text}`)
    }

    return res.json() as Promise<T>
  }

  // ── Transactions ──

  searchTransactions(params: Record<string, unknown> = {}) {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== "") qs.set(k, String(v))
    })
    const str = qs.toString()
    return this.request<{
      transactions: Record<string, unknown>[]
      total_returned: number
    }>("GET", `/api/transactions${str ? `?${str}` : ""}`)
  }

  // ── Transfers ──

  searchTransfers(params: Record<string, unknown> = {}) {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== "") qs.set(k, String(v))
    })
    const str = qs.toString()
    return this.request<{
      transfers: Record<string, unknown>[]
      total_returned: number
    }>("GET", `/api/transfers${str ? `?${str}` : ""}`)
  }

  // ── Summary / Metadata ──

  getMetadata() {
    return this.request<{
      years: number[]
      accounts: string[]
      categories: string[]
      secondary_categories: string[]
      tertiary_categories: string[]
      currencies: string[]
      tags: string[]
      transaction_count: number
      transfer_count: number
    }>("GET", "/api/metadata")
  }

  // ── Monthly Report ──

  getMonthlyReport(year: number, month: number, currency?: string) {
    const qs = new URLSearchParams({ year: String(year), month: String(month) })
    if (currency) qs.set("currency", currency)
    return this.request<{
      total_income: number
      total_expense: number
      net_amount: number
      transaction_count: number
      transfer_count: number
      total_transfer_in: number
      total_transfer_out: number
      expense_by_category: Array<{ category: string; total: number; count: number }>
      income_by_category: Array<{ category: string; total: number; count: number }>
      currencies: string[]
    }>("GET", `/api/reports/monthly?${qs}`)
  }

  // ── Products ──

  listProducts(filters?: { channel?: string | undefined; category?: string | undefined; currency?: string | undefined }) {
    const qs = new URLSearchParams()
    if (filters?.channel) qs.set("channel", filters.channel)
    if (filters?.category) qs.set("category", filters.category)
    if (filters?.currency) qs.set("currency", filters.currency)
    const str = qs.toString()
    return this.request<{
      products: Record<string, unknown>[]
      total_returned: number
    }>("GET", `/api/products${str ? `?${str}` : ""}`)
  }

  getProduct(id: string) {
    return this.request<{ product: Record<string, unknown> | null }>(
      "GET", `/api/products/${id}`,
    )
  }

  createProduct(data: Record<string, unknown>) {
    return this.request<{ product: Record<string, unknown> }>(
      "POST", "/api/products", data,
    )
  }

  updateProduct(id: string, data: Record<string, unknown>) {
    return this.request<{ product: Record<string, unknown> }>(
      "PUT", `/api/products/${id}`, data,
    )
  }

  deleteProduct(id: string) {
    return this.request<{ success: boolean }>(
      "DELETE", `/api/products/${id}`,
    )
  }

  // ── Units ──

  listUnits(filters?: {
    status?: string | undefined
    strategy?: string | undefined
    tactics?: string | undefined
    currency?: string | undefined
    with_products?: boolean | undefined
  }) {
    const qs = new URLSearchParams()
    if (filters?.status) qs.set("status", filters.status)
    if (filters?.strategy) qs.set("strategy", filters.strategy)
    if (filters?.tactics) qs.set("tactics", filters.tactics)
    if (filters?.currency) qs.set("currency", filters.currency)
    if (filters?.with_products) qs.set("with_products", "true")
    const str = qs.toString()
    return this.request<{
      units: Record<string, unknown>[]
      total_returned: number
    }>("GET", `/api/units${str ? `?${str}` : ""}`)
  }

  getUnit(id: string, withProduct = false) {
    const qs = withProduct ? "?with_products=true" : ""
    return this.request<{ unit: Record<string, unknown> | null }>(
      "GET", `/api/units/${id}${qs}`,
    )
  }

  createUnit(data: Record<string, unknown>) {
    return this.request<{ unit: Record<string, unknown> }>(
      "POST", "/api/units", data,
    )
  }

  updateUnit(id: string, data: Record<string, unknown>) {
    return this.request<{ unit: Record<string, unknown> }>(
      "PUT", `/api/units/${id}`, data,
    )
  }

  deleteUnit(id: string) {
    return this.request<{ success: boolean }>(
      "DELETE", `/api/units/${id}`,
    )
  }
}
