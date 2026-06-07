import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockClient, getAuthedClient } = vi.hoisted(() => {
  return {
    mockClient: {
      createExpenseCategory: vi.fn(),
      updateExpenseCategory: vi.fn(),
      deleteExpenseCategory: vi.fn(),
    },
    getAuthedClient: vi.fn(),
  };
});

vi.mock("@/lib/api-helpers", () => ({
  getAuthedClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createExpenseCategory,
  deleteExpenseCategory,
  updateExpenseCategory,
} from "@/app/actions/expense-category-actions";
import { WorkerDbError } from "@/lib/worker-db-client";

describe("expense-category Server Actions (P2-C7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthedClient.mockResolvedValue({ userId: "u1", client: mockClient });
  });

  test("create: zod failure returns ActionResult.error without hitting worker", async () => {
    const res = await createExpenseCategory({
      name: "",
      colorToken: "chart-1",
    });
    expect(res.success).toBe(false);
    expect(mockClient.createExpenseCategory).not.toHaveBeenCalled();
  });

  test("create: bad colorToken caught at Zod layer", async () => {
    const res = await createExpenseCategory({
      name: "保险",
      colorToken: "rgb(0,0,0)",
    });
    expect(res.success).toBe(false);
  });

  test("create: happy path returns the new id", async () => {
    mockClient.createExpenseCategory.mockResolvedValueOnce({
      category: { id: "c1", userId: "u1" },
    });
    const res = await createExpenseCategory({
      name: "保险",
      colorToken: "chart-9",
    });
    expect(res).toEqual({ success: true, data: { id: "c1" } });
    expect(mockClient.createExpenseCategory).toHaveBeenCalledWith("u1", {
      name: "保险",
      colorToken: "chart-9",
    });
  });

  test("create: 409 from worker is mapped to '分类名已存在'", async () => {
    mockClient.createExpenseCategory.mockRejectedValueOnce(
      new WorkerDbError("dup", 409, "POST /api/expense-categories"),
    );
    const res = await createExpenseCategory({
      name: "保险",
      colorToken: "chart-9",
    });
    expect(res).toEqual({ success: false, error: "分类名已存在" });
  });

  test("create: generic worker error propagates", async () => {
    mockClient.createExpenseCategory.mockRejectedValueOnce(
      new WorkerDbError("server is down", 500, "POST /api/expense-categories"),
    );
    const res = await createExpenseCategory({
      name: "保险",
      colorToken: "chart-9",
    });
    expect(res).toEqual({ success: false, error: "server is down" });
  });

  test("update: partial input ok; unknown fields stripped by Zod", async () => {
    mockClient.updateExpenseCategory.mockResolvedValueOnce(undefined);
    const res = await updateExpenseCategory("c1", {
      name: "renamed",
      sneaky: true,
    });
    expect(res.success).toBe(true);
    const args = mockClient.updateExpenseCategory.mock.calls[0];
    if (!args) throw new Error("no call");
    expect(args[2]).toEqual({ name: "renamed" });
  });

  test("update: 409 from worker mapped to '分类名已存在'", async () => {
    mockClient.updateExpenseCategory.mockRejectedValueOnce(
      new WorkerDbError("dup", 409, "PUT /api/expense-categories/c1"),
    );
    const res = await updateExpenseCategory("c1", { name: "保险" });
    expect(res).toEqual({ success: false, error: "分类名已存在" });
  });

  test("delete: happy path returns success", async () => {
    mockClient.deleteExpenseCategory.mockResolvedValueOnce(undefined);
    const res = await deleteExpenseCategory("c1");
    expect(res.success).toBe(true);
    expect(mockClient.deleteExpenseCategory).toHaveBeenCalledWith("u1", "c1");
  });

  test("delete: 404 from worker propagates", async () => {
    mockClient.deleteExpenseCategory.mockRejectedValueOnce(
      new WorkerDbError("Not found", 404, "DELETE /api/expense-categories/c1"),
    );
    const res = await deleteExpenseCategory("c1");
    expect(res).toEqual({ success: false, error: "Not found" });
  });

  test("auth failure surfaces as ActionResult.error", async () => {
    getAuthedClient.mockRejectedValueOnce(new Error("Not authenticated"));
    const res = await createExpenseCategory({
      name: "x",
      colorToken: "chart-1",
    });
    expect(res).toEqual({ success: false, error: "Not authenticated" });
  });
});
