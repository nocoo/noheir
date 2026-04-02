/**
 * Unit Tests: WorkerClient
 *
 * Tests HTTP client with mocked fetch to verify correct API paths and parameters.
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { WorkerClient } from "../src/worker-client";

const BASE_URL = "https://test.worker.api";
const TOKEN = "test-token";
const USER_ID = "test-user-123";

// Mock response helper
function mockFetchResponse<T>(data: T) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function mockFetchError(status: number, text: string) {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => text,
  };
}

describe("WorkerClient", () => {
  let client: WorkerClient;
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    client = new WorkerClient(BASE_URL, TOKEN, USER_ID);
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Transactions
  // ────────────────────────────────────────────────────────────────────────────

  describe("searchTransactions", () => {
    it("calls POST /api/transactions/search with params in body", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ transactions: [], total_returned: 0 }));

      await client.searchTransactions({ keyword: "test", year: 2026 });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/transactions/search`);
      expect(options.method).toBe("POST");
      expect(options.body).toBe(JSON.stringify({ keyword: "test", year: 2026 }));
    });

    it("sends correct headers", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ transactions: [], total_returned: 0 }));

      await client.searchTransactions({});

      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe(`Bearer ${TOKEN}`);
      expect(headers["X-User-Id"]).toBe(USER_ID);
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("returns response data", async () => {
      const responseData = { transactions: [{ id: "1", note: "test" }], total_returned: 1 };
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(responseData));

      const result = await client.searchTransactions({});

      expect(result).toEqual(responseData);
    });

    it("passes amount_cents params directly to backend", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ transactions: [], total_returned: 0 }));

      await client.searchTransactions({
        min_amount_cents: 1000,
        max_amount_cents: 5000,
      });

      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.min_amount_cents).toBe(1000);
      expect(body.max_amount_cents).toBe(5000);
    });

    it("passes tags array to backend", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ transactions: [], total_returned: 0 }));

      await client.searchTransactions({ tags: ["日常", "工作餐"] });

      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.tags).toEqual(["日常", "工作餐"]);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Transfers
  // ────────────────────────────────────────────────────────────────────────────

  describe("searchTransfers", () => {
    it("calls POST /api/transfers/search with params in body", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ transfers: [], total_returned: 0 }));

      await client.searchTransfers({ accounts: ["招商银行"] });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/transfers/search`);
      expect(options.method).toBe("POST");
      expect(options.body).toBe(JSON.stringify({ accounts: ["招商银行"] }));
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Metadata
  // ────────────────────────────────────────────────────────────────────────────

  describe("getMetadata", () => {
    it("calls GET /api/reports/metadata", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({
        years: [2026],
        accounts: [],
        categories: [],
        secondary_categories: [],
        tertiary_categories: [],
        currencies: [],
        tags: [],
        transaction_count: 0,
        transfer_count: 0,
      }));

      await client.getMetadata();

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/reports/metadata`);
      expect(options.method).toBe("GET");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Monthly Report
  // ────────────────────────────────────────────────────────────────────────────

  describe("getMonthlyReport", () => {
    it("calls GET /api/reports/monthly-summary with query params", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({
        total_income: 0,
        total_expense: 0,
        net_amount: 0,
        transaction_count: 0,
        transfer_count: 0,
        total_transfer_in: 0,
        total_transfer_out: 0,
        expense_by_category: [],
        income_by_category: [],
        currencies: [],
      }));

      await client.getMonthlyReport(2026, 3);

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/reports/monthly-summary?year=2026&month=3`);
    });

    it("includes currency filter in query params", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({
        total_income: 0,
        total_expense: 0,
        net_amount: 0,
        transaction_count: 0,
        transfer_count: 0,
        total_transfer_in: 0,
        total_transfer_out: 0,
        expense_by_category: [],
        income_by_category: [],
        currencies: [],
      }));

      await client.getMonthlyReport(2026, 3, "CNY");

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("currency=CNY");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Products CRUD
  // ────────────────────────────────────────────────────────────────────────────

  describe("listProducts", () => {
    it("calls GET /api/products with no params", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ products: [], total_returned: 0 }));

      await client.listProducts();

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/products`);
    });

    it("includes filter params in query string", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ products: [], total_returned: 0 }));

      await client.listProducts({ channel: "招商银行", category: "债券基金" });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("channel=");
      expect(url).toContain("category=");
    });
  });

  describe("getProduct", () => {
    it("calls GET /api/products/:id", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ product: null }));

      await client.getProduct("uuid-123");

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/products/uuid-123`);
    });
  });

  describe("createProduct", () => {
    it("calls POST /api/products with body", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ product: { id: "new" } }));

      await client.createProduct({ name: "Test", channel: "银行", category: "基金" });

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/products`);
      expect(options.method).toBe("POST");
      expect(options.body).toContain("Test");
    });
  });

  describe("updateProduct", () => {
    it("calls PUT /api/products/:id with body", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ product: { id: "uuid-123" } }));

      await client.updateProduct("uuid-123", { name: "Updated" });

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/products/uuid-123`);
      expect(options.method).toBe("PUT");
      expect(options.body).toContain("Updated");
    });
  });

  describe("deleteProduct", () => {
    it("calls DELETE /api/products/:id", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ success: true }));

      await client.deleteProduct("uuid-123");

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/products/uuid-123`);
      expect(options.method).toBe("DELETE");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Units CRUD
  // ────────────────────────────────────────────────────────────────────────────

  describe("listUnits", () => {
    it("calls GET /api/units with no params", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ units: [], total_returned: 0 }));

      await client.listUnits();

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/units`);
    });

    it("includes filter params in query string", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ units: [], total_returned: 0 }));

      await client.listUnits({ status: "已成立", strategy: "短期理财" });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("status=");
      expect(url).toContain("strategy=");
    });

    it("includes with_products param", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ units: [], total_returned: 0 }));

      await client.listUnits({ with_products: true });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("with_products=true");
    });
  });

  describe("getUnit", () => {
    it("calls GET /api/units/:id", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ unit: null }));

      await client.getUnit("uuid-456");

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/units/uuid-456`);
    });

    it("includes with_products query param when requested", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ unit: null }));

      await client.getUnit("uuid-456", true);

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("with_products=true");
    });
  });

  describe("createUnit", () => {
    it("calls POST /api/units with body", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ unit: { id: "new" } }));

      await client.createUnit({
        unit_code: "E01",
        amount: 50000,
        strategy: "短期理财",
        tactics: "债券基金",
      });

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/units`);
      expect(options.method).toBe("POST");
      expect(options.body).toContain("E01");
    });
  });

  describe("updateUnit", () => {
    it("calls PUT /api/units/:id with body", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ unit: { id: "uuid-456" } }));

      await client.updateUnit("uuid-456", { amount: 60000 });

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/units/uuid-456`);
      expect(options.method).toBe("PUT");
      expect(options.body).toContain("60000");
    });
  });

  describe("deleteUnit", () => {
    it("calls DELETE /api/units/:id", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ success: true }));

      await client.deleteUnit("uuid-456");

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/units/uuid-456`);
      expect(options.method).toBe("DELETE");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Error Handling
  // ────────────────────────────────────────────────────────────────────────────

  describe("error handling", () => {
    it("throws on non-ok response", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchError(401, "Unauthorized"));

      await expect(client.searchTransactions({})).rejects.toThrow(
        "Worker API POST /api/transactions/search: 401 — Unauthorized"
      );
    });

    it("throws on 404", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchError(404, "Not found"));

      await expect(client.getProduct("nonexistent")).rejects.toThrow(
        "Worker API GET /api/products/nonexistent: 404 — Not found"
      );
    });

    it("throws on 500", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchError(500, "Internal error"));

      await expect(client.getMetadata()).rejects.toThrow(
        "Worker API GET /api/reports/metadata: 500 — Internal error"
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Base URL normalization
  // ────────────────────────────────────────────────────────────────────────────

  describe("base URL normalization", () => {
    it("strips trailing slash from base URL", async () => {
      const clientWithSlash = new WorkerClient(`${BASE_URL}/`, TOKEN, USER_ID);
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ products: [], total_returned: 0 }));

      await clientWithSlash.listProducts();

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/api/products`);
      expect(url).not.toContain("//api");
    });
  });
});
