import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockClient, getAuthedClient } = vi.hoisted(() => ({
  mockClient: {
    updateRecurringExpense: vi.fn(),
    listRecurringExpenses: vi.fn(),
  },
  getAuthedClient: vi.fn(),
}));

vi.mock("@/lib/api-helpers", () => ({ getAuthedClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  endRecurringExpense,
  pauseRecurringExpense,
  resumeRecurringExpense,
} from "@/app/actions/recurring-expense-state-actions";
import { WorkerDbError } from "@/lib/worker-db-client";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function ruleWithStatus(status: "active" | "paused" | "ended"): unknown {
  return {
    id: "r1",
    userId: "u1",
    name: "Netflix",
    categoryId: null,
    amountCents: 1000,
    currency: "CNY",
    account: null,
    frequency: "monthly",
    interval: 1,
    dayOfMonth: 5,
    monthOfYear: null,
    weekday: null,
    startDate: "2026-01-05",
    endDate: null,
    status,
    endedAt: status === "ended" ? "2026-05-01" : null,
    note: null,
  };
}

function mockRule(status: "active" | "paused" | "ended"): void {
  mockClient.listRecurringExpenses.mockResolvedValueOnce({
    rules: [ruleWithStatus(status)],
  });
}

describe("recurring-expense state-machine Server Actions (P2-C9)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getAuthedClient.mockResolvedValue({ userId: "u1", client: mockClient });
  });

  // ── Legal transitions ─────────────────────────────────────────────

  test("active → pause: status='paused', endedAt=null, internal channel", async () => {
    mockRule("active");
    mockClient.updateRecurringExpense.mockResolvedValueOnce(undefined);
    const res = await pauseRecurringExpense("r1");
    expect(res.success).toBe(true);
    const call = mockClient.updateRecurringExpense.mock.calls[0];
    if (!call) throw new Error("no call");
    expect(call[0]).toBe("u1");
    expect(call[1]).toBe("r1");
    expect(call[2]).toEqual({ status: "paused", endedAt: null });
    expect(call[3]).toEqual({ internal: true });
  });

  test("paused → resume: status='active', endedAt=null, internal channel", async () => {
    mockRule("paused");
    mockClient.updateRecurringExpense.mockResolvedValueOnce(undefined);
    const res = await resumeRecurringExpense("r1");
    expect(res.success).toBe(true);
    const call = mockClient.updateRecurringExpense.mock.calls[0];
    if (!call) throw new Error("no call");
    expect(call[2]).toEqual({ status: "active", endedAt: null });
    expect(call[3]).toEqual({ internal: true });
  });

  test("active → end: status='ended', endedAt=todayIsoUtc(), internal channel", async () => {
    mockRule("active");
    mockClient.updateRecurringExpense.mockResolvedValueOnce(undefined);
    const res = await endRecurringExpense("r1");
    expect(res.success).toBe(true);
    const call = mockClient.updateRecurringExpense.mock.calls[0];
    if (!call) throw new Error("no call");
    const payload = call[2] as { status: string; endedAt: string };
    expect(payload.status).toBe("ended");
    expect(payload.endedAt).toMatch(ISO_DATE_RE);
    expect(call[3]).toEqual({ internal: true });
  });

  test("paused → end: also legal", async () => {
    mockRule("paused");
    mockClient.updateRecurringExpense.mockResolvedValueOnce(undefined);
    const res = await endRecurringExpense("r1");
    expect(res.success).toBe(true);
    expect(mockClient.updateRecurringExpense).toHaveBeenCalledTimes(1);
  });

  // ── Illegal transitions: must NOT call updateRecurringExpense ────

  test("ended → pause: rejected, worker not called", async () => {
    mockRule("ended");
    const res = await pauseRecurringExpense("r1");
    expect(res).toEqual({
      success: false,
      error: "当前状态为「已结束」，无法暂停",
    });
    expect(mockClient.updateRecurringExpense).not.toHaveBeenCalled();
  });

  test("ended → resume: rejected, worker not called", async () => {
    mockRule("ended");
    const res = await resumeRecurringExpense("r1");
    expect(res).toEqual({
      success: false,
      error: "当前状态为「已结束」，无法恢复",
    });
    expect(mockClient.updateRecurringExpense).not.toHaveBeenCalled();
  });

  test("ended → end: rejected (idempotent end is NOT silently allowed)", async () => {
    mockRule("ended");
    const res = await endRecurringExpense("r1");
    expect(res).toEqual({
      success: false,
      error: "当前状态为「已结束」，无法结束",
    });
    expect(mockClient.updateRecurringExpense).not.toHaveBeenCalled();
  });

  test("paused → pause: rejected (idempotent pause is NOT allowed)", async () => {
    mockRule("paused");
    const res = await pauseRecurringExpense("r1");
    expect(res).toEqual({
      success: false,
      error: "当前状态为「已暂停」，无法暂停",
    });
    expect(mockClient.updateRecurringExpense).not.toHaveBeenCalled();
  });

  test("active → resume: rejected", async () => {
    mockRule("active");
    const res = await resumeRecurringExpense("r1");
    expect(res).toEqual({
      success: false,
      error: "当前状态为「进行中」，无法恢复",
    });
    expect(mockClient.updateRecurringExpense).not.toHaveBeenCalled();
  });

  // ── Rule lookup edge cases ────────────────────────────────────────

  test("rule not found → error, worker not called", async () => {
    mockClient.listRecurringExpenses.mockResolvedValueOnce({ rules: [] });
    const res = await pauseRecurringExpense("missing");
    expect(res).toEqual({ success: false, error: "规则不存在" });
    expect(mockClient.updateRecurringExpense).not.toHaveBeenCalled();
  });

  test("worker returns unknown status → error surfaces, worker not called", async () => {
    mockClient.listRecurringExpenses.mockResolvedValueOnce({
      rules: [{ ...(ruleWithStatus("active") as Record<string, unknown>), status: "weird" }],
    });
    const res = await pauseRecurringExpense("r1");
    expect(res.success).toBe(false);
    if (res.success) throw new Error("expected failure");
    expect(res.error).toContain("Unknown rule status");
    expect(mockClient.updateRecurringExpense).not.toHaveBeenCalled();
  });

  // ── Date math ─────────────────────────────────────────────────────

  test("end uses UTC date (deterministic regardless of TZ)", async () => {
    mockRule("active");
    mockClient.updateRecurringExpense.mockResolvedValueOnce(undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T22:00:00Z"));
    try {
      await endRecurringExpense("r1");
      const call = mockClient.updateRecurringExpense.mock.calls[0];
      if (!call) throw new Error("no call");
      const payload = call[2] as { endedAt: string };
      expect(payload.endedAt).toBe("2026-06-07");
    } finally {
      vi.useRealTimers();
    }
  });

  test("end at UTC midnight boundary picks the NEXT UTC day", async () => {
    mockRule("active");
    mockClient.updateRecurringExpense.mockResolvedValueOnce(undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T23:59:59Z"));
    try {
      await endRecurringExpense("r1");
      const call = mockClient.updateRecurringExpense.mock.calls[0];
      if (!call) throw new Error("no call");
      const payload = call[2] as { endedAt: string };
      expect(payload.endedAt).toBe("2026-06-07");
    } finally {
      vi.useRealTimers();
    }
    mockRule("active");
    mockClient.updateRecurringExpense.mockResolvedValueOnce(undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T00:00:01Z"));
    try {
      await endRecurringExpense("r1");
      const call = mockClient.updateRecurringExpense.mock.calls[1];
      if (!call) throw new Error("no call");
      const payload = call[2] as { endedAt: string };
      expect(payload.endedAt).toBe("2026-06-08");
    } finally {
      vi.useRealTimers();
    }
  });

  // ── Error propagation ────────────────────────────────────────────

  test("worker error during update propagates", async () => {
    mockRule("active");
    mockClient.updateRecurringExpense.mockRejectedValueOnce(
      new WorkerDbError("Not found", 404, "PUT /api/recurring-expenses/r1"),
    );
    const res = await pauseRecurringExpense("r1");
    expect(res).toEqual({ success: false, error: "Not found" });
  });

  test("auth failure surfaces from all three", async () => {
    getAuthedClient.mockRejectedValue(new Error("Not authenticated"));
    expect(await pauseRecurringExpense("r1")).toEqual({
      success: false,
      error: "Not authenticated",
    });
    expect(await resumeRecurringExpense("r1")).toEqual({
      success: false,
      error: "Not authenticated",
    });
    expect(await endRecurringExpense("r1")).toEqual({
      success: false,
      error: "Not authenticated",
    });
    expect(mockClient.updateRecurringExpense).not.toHaveBeenCalled();
  });

  test("listRecurringExpenses error propagates, update not called", async () => {
    mockClient.listRecurringExpenses.mockRejectedValueOnce(
      new WorkerDbError("DB down", 500, "GET /api/recurring-expenses"),
    );
    const res = await pauseRecurringExpense("r1");
    expect(res).toEqual({ success: false, error: "DB down" });
    expect(mockClient.updateRecurringExpense).not.toHaveBeenCalled();
  });

  // ── Payload tamper-proofing ───────────────────────────────────────

  test("caller cannot override the protected fields — id is the only input", async () => {
    mockRule("active");
    mockClient.updateRecurringExpense.mockResolvedValueOnce(undefined);
    await pauseRecurringExpense("r1");
    const call = mockClient.updateRecurringExpense.mock.calls[0];
    if (!call) throw new Error("no call");
    expect(Object.keys(call[2] as Record<string, unknown>).sort()).toEqual(["endedAt", "status"]);
  });
});
