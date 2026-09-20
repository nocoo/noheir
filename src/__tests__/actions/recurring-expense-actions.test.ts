import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockWorkerDbClient } = vi.hoisted(() => ({
  mockWorkerDbClient: {
    createRecurringExpense: vi.fn(),
    updateRecurringExpense: vi.fn(),
    deleteRecurringExpense: vi.fn(),
  },
}));

vi.mock("@/lib/worker-db-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/worker-db-client")>();
  return {
    ...actual,
    workerDbClient: mockWorkerDbClient,
  };
});

import {
  createRecurringExpense,
  deleteRecurringExpense,
  updateRecurringExpense,
} from "@/app/actions/recurring-expense-actions";

const yearlyInput = {
  name: "中行车险",
  amount: 8000, // yuan
  frequency: "yearly",
  interval: 1,
  monthOfYear: 1,
  dayOfMonth: 5,
  startDate: "2026-01-05",
};

describe("recurring-expense CRUD actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("create: zod failure short-circuits", async () => {
    const res = await createRecurringExpense({
      ...yearlyInput,
      name: "",
    });
    expect(res.success).toBe(false);
    expect(mockWorkerDbClient.createRecurringExpense).not.toHaveBeenCalled();
  });

  test("create: converts amount (yuan) to amountCents", async () => {
    mockWorkerDbClient.createRecurringExpense.mockResolvedValueOnce({
      rule: { id: "rule-1" },
    });
    const res = await createRecurringExpense(yearlyInput);
    expect(res).toEqual({ success: true, data: { id: "rule-1" } });
    expect(mockWorkerDbClient.createRecurringExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "中行车险",
        amountCents: 800000,
      }),
    );
  });

  test("update: converts amount (yuan) to amountCents when provided", async () => {
    mockWorkerDbClient.updateRecurringExpense.mockResolvedValueOnce({});
    const res = await updateRecurringExpense("rule-1", { amount: 9000 });
    expect(res).toEqual({ success: true, data: undefined });
    expect(mockWorkerDbClient.updateRecurringExpense).toHaveBeenCalledWith("rule-1", {
      amountCents: 900000,
    });
  });

  test("delete: calls worker delete endpoint", async () => {
    mockWorkerDbClient.deleteRecurringExpense.mockResolvedValueOnce(undefined);
    const res = await deleteRecurringExpense("rule-1");
    expect(res).toEqual({ success: true, data: undefined });
    expect(mockWorkerDbClient.deleteRecurringExpense).toHaveBeenCalledWith("rule-1");
  });
});
