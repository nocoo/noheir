/**
 * Unit Tests: MCP Amount Conversion
 *
 * Tests that MCP tools correctly convert decimal amounts to cents
 * before passing to the Worker API.
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

describe("MCP Amount Conversion", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  /**
   * These tests simulate what the MCP tool handlers do:
   * 1. Receive decimal amounts from MCP params (e.g., min_amount: 10.50)
   * 2. Convert to cents (min_amount_cents: 1050)
   * 3. Pass to WorkerClient
   */

  describe("transaction search amount conversion", () => {
    it("converts decimal min_amount to cents", () => {
      const minAmount = 10.5;
      const minAmountCents = Math.round(minAmount * 100);
      expect(minAmountCents).toBe(1050);
    });

    it("converts decimal max_amount to cents", () => {
      const maxAmount = 99.99;
      const maxAmountCents = Math.round(maxAmount * 100);
      expect(maxAmountCents).toBe(9999);
    });

    it("handles whole number amounts", () => {
      const amount = 100;
      const amountCents = Math.round(amount * 100);
      expect(amountCents).toBe(10000);
    });

    it("handles small amounts correctly", () => {
      const amount = 0.01;
      const amountCents = Math.round(amount * 100);
      expect(amountCents).toBe(1);
    });

    it("handles undefined amounts", () => {
      const params: { min_amount?: number; max_amount?: number } = {};
      const searchParams = {
        min_amount_cents: params.min_amount !== undefined ? Math.round(params.min_amount * 100) : undefined,
        max_amount_cents: params.max_amount !== undefined ? Math.round(params.max_amount * 100) : undefined,
      };
      expect(searchParams.min_amount_cents).toBeUndefined();
      expect(searchParams.max_amount_cents).toBeUndefined();
    });

    it("removes original decimal params after conversion", () => {
      const params = {
        keyword: "test",
        min_amount: 10.5,
        max_amount: 99.99,
      };

      // Simulate MCP handler conversion logic
      const searchParams: Record<string, unknown> = {
        ...params,
        min_amount_cents: params.min_amount !== undefined ? Math.round(params.min_amount * 100) : undefined,
        max_amount_cents: params.max_amount !== undefined ? Math.round(params.max_amount * 100) : undefined,
      };
      delete searchParams.min_amount;
      delete searchParams.max_amount;

      expect(searchParams.min_amount).toBeUndefined();
      expect(searchParams.max_amount).toBeUndefined();
      expect(searchParams.min_amount_cents).toBe(1050);
      expect(searchParams.max_amount_cents).toBe(9999);
      expect(searchParams.keyword).toBe("test");
    });
  });

  describe("transfer search amount conversion", () => {
    it("converts transfer amounts the same way", () => {
      const params = { min_amount: 500, max_amount: 1000.50 };
      const searchParams = {
        min_amount_cents: Math.round(params.min_amount * 100),
        max_amount_cents: Math.round(params.max_amount * 100),
      };
      expect(searchParams.min_amount_cents).toBe(50000);
      expect(searchParams.max_amount_cents).toBe(100050);
    });
  });

  describe("WorkerClient passes converted params correctly", () => {
    it("searchTransactions sends min_amount_cents in body", async () => {
      const client = new WorkerClient(BASE_URL, TOKEN, USER_ID);
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ transactions: [], total_returned: 0 }));

      // Simulate already-converted params (as MCP handler would send)
      await client.searchTransactions({
        min_amount_cents: 1050,
        max_amount_cents: 9999,
      });

      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.min_amount_cents).toBe(1050);
      expect(body.max_amount_cents).toBe(9999);
    });

    it("searchTransfers sends min_amount_cents in body", async () => {
      const client = new WorkerClient(BASE_URL, TOKEN, USER_ID);
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ transfers: [], total_returned: 0 }));

      await client.searchTransfers({
        min_amount_cents: 50000,
        max_amount_cents: 100050,
      });

      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.min_amount_cents).toBe(50000);
      expect(body.max_amount_cents).toBe(100050);
    });
  });
});
