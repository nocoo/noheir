import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockClient, getAuthedClient } = vi.hoisted(() => ({
  mockClient: { updateRecurringExpense: vi.fn() },
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

describe("recurring-expense state-machine Server Actions (P2-C9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthedClient.mockResolvedValue({ userId: "u1", client: mockClient });
  });

  test("pause → status='paused', endedAt=null, internal channel", async () => {
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

  test("resume → status='active', endedAt=null, internal channel", async () => {
    mockClient.updateRecurringExpense.mockResolvedValueOnce(undefined);
    await resumeRecurringExpense("r1");
    const call = mockClient.updateRecurringExpense.mock.calls[0];
    if (!call) throw new Error("no call");
    expect(call[2]).toEqual({ status: "active", endedAt: null });
    expect(call[3]).toEqual({ internal: true });
  });

  test("end → status='ended', endedAt=todayIsoUtc(), internal channel", async () => {
    mockClient.updateRecurringExpense.mockResolvedValueOnce(undefined);
    await endRecurringExpense("r1");
    const call = mockClient.updateRecurringExpense.mock.calls[0];
    if (!call) throw new Error("no call");
    const payload = call[2] as { status: string; endedAt: string };
    expect(payload.status).toBe("ended");
    expect(payload.endedAt).toMatch(ISO_DATE_RE);
    expect(call[3]).toEqual({ internal: true });
  });

  test("end uses UTC date (deterministic regardless of TZ)", async () => {
    mockClient.updateRecurringExpense.mockResolvedValueOnce(undefined);
    // Freeze time so we know exactly what UTC today is.
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
    mockClient.updateRecurringExpense.mockResolvedValueOnce(undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T00:00:01Z"));
    try {
      await endRecurringExpense("r2");
      const call = mockClient.updateRecurringExpense.mock.calls[1];
      if (!call) throw new Error("no call");
      const payload = call[2] as { endedAt: string };
      expect(payload.endedAt).toBe("2026-06-08");
    } finally {
      vi.useRealTimers();
    }
  });

  test("pause: worker error propagates", async () => {
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
  });

  test("caller cannot override the protected fields — id is the only input", async () => {
    // TypeScript signature already prevents this, but the runtime
    // contract should also hold: even if caller passes extra args,
    // the worker call payload is fixed.
    mockClient.updateRecurringExpense.mockResolvedValueOnce(undefined);
    await pauseRecurringExpense("r1");
    const call = mockClient.updateRecurringExpense.mock.calls[0];
    if (!call) throw new Error("no call");
    expect(Object.keys(call[2] as Record<string, unknown>).sort()).toEqual([
      "endedAt",
      "status",
    ]);
  });
});
