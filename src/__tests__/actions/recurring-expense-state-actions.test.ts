import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockWorkerDbClient } = vi.hoisted(() => ({
  mockWorkerDbClient: {
    transitionRecurringExpense: vi.fn(),
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
  endRecurringExpense,
  pauseRecurringExpense,
  resumeRecurringExpense,
} from "@/app/actions/recurring-expense-state-actions";
import { WorkerDbError } from "@/lib/worker-db-client";

describe("recurring-expense state transition actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("pause sends transition=pause to backend", async () => {
    mockWorkerDbClient.transitionRecurringExpense.mockResolvedValueOnce({ success: true });
    const res = await pauseRecurringExpense("r1");
    expect(res).toEqual({ success: true, data: undefined });
    expect(mockWorkerDbClient.transitionRecurringExpense).toHaveBeenCalledWith("r1", "pause");
  });

  test("resume sends transition=resume to backend", async () => {
    mockWorkerDbClient.transitionRecurringExpense.mockResolvedValueOnce({ success: true });
    const res = await resumeRecurringExpense("r1");
    expect(res).toEqual({ success: true, data: undefined });
    expect(mockWorkerDbClient.transitionRecurringExpense).toHaveBeenCalledWith("r1", "resume");
  });

  test("end sends transition=end to backend", async () => {
    mockWorkerDbClient.transitionRecurringExpense.mockResolvedValueOnce({ success: true });
    const res = await endRecurringExpense("r1");
    expect(res).toEqual({ success: true, data: undefined });
    expect(mockWorkerDbClient.transitionRecurringExpense).toHaveBeenCalledWith("r1", "end");
  });

  test("returns error when worker fails", async () => {
    mockWorkerDbClient.transitionRecurringExpense.mockRejectedValueOnce(
      new WorkerDbError("Illegal state transition", 400, "POST /api/recurring-expenses/r1/state"),
    );
    const res = await pauseRecurringExpense("r1");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe("Illegal state transition");
    }
  });
});
