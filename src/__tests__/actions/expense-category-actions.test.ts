import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockWorkerDbClient } = vi.hoisted(() => {
  return {
    mockWorkerDbClient: {
      createExpenseCategory: vi.fn(),
      updateExpenseCategory: vi.fn(),
      deleteExpenseCategory: vi.fn(),
    },
  };
});

vi.mock("@/lib/worker-db-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/worker-db-client")>();
  return {
    ...actual,
    workerDbClient: mockWorkerDbClient,
  };
});

import {
  createExpenseCategory,
  deleteExpenseCategory,
  updateExpenseCategory,
} from "@/app/actions/expense-category-actions";
import { WorkerDbError } from "@/lib/worker-db-client";

describe("expense-category actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("create: zod failure returns ActionResult.error without hitting worker", async () => {
    const res = await createExpenseCategory({
      name: "",
      colorToken: "chart-1",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBeDefined();
    }
    expect(mockWorkerDbClient.createExpenseCategory).not.toHaveBeenCalled();
  });

  test("create: calls worker with valid payload and returns id", async () => {
    mockWorkerDbClient.createExpenseCategory.mockResolvedValueOnce({
      category: { id: "cat-new" },
    });
    const res = await createExpenseCategory({
      name: "餐饮",
      colorToken: "chart-1",
      sortOrder: 1,
    });
    expect(res).toEqual({ success: true, data: { id: "cat-new" } });
    expect(mockWorkerDbClient.createExpenseCategory).toHaveBeenCalledWith({
      name: "餐饮",
      colorToken: "chart-1",
      sortOrder: 1,
    });
  });

  test("create: maps 409 conflict to duplicate name message", async () => {
    mockWorkerDbClient.createExpenseCategory.mockRejectedValueOnce(
      new WorkerDbError("conflict", 409, "POST /api/expense-categories"),
    );
    const res = await createExpenseCategory({
      name: "餐饮",
      colorToken: "chart-1",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe("分类名已存在");
    }
  });

  test("update: calls worker with partial payload", async () => {
    mockWorkerDbClient.updateExpenseCategory.mockResolvedValueOnce({});
    const res = await updateExpenseCategory("cat-1", { name: "新名称" });
    expect(res).toEqual({ success: true, data: undefined });
    expect(mockWorkerDbClient.updateExpenseCategory).toHaveBeenCalledWith("cat-1", {
      name: "新名称",
    });
  });

  test("delete: calls worker with id", async () => {
    mockWorkerDbClient.deleteExpenseCategory.mockResolvedValueOnce(undefined);
    const res = await deleteExpenseCategory("cat-1");
    expect(res).toEqual({ success: true, data: undefined });
    expect(mockWorkerDbClient.deleteExpenseCategory).toHaveBeenCalledWith("cat-1");
  });
});
