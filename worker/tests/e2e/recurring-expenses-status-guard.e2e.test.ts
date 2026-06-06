// Regression pin for the X-Internal-Action contract. P1-C6 covers the
// happy paths; this file is the canary that fires if a future refactor
// accidentally drops the header check or stops stripping the protected
// fields.

import { beforeEach, describe, expect, test } from "vitest";
import { api, rawFetch, TEST_USER_C } from "./helpers/client";
import { ensureTestUser } from "./helpers/cleanup";

const userId = TEST_USER_C;

interface Rule {
  id: string;
  status: "active" | "paused" | "ended";
  endedAt: string | null;
  name: string;
}

const baseBody = {
  name: "guard-regression",
  amountCents: 100_000,
  frequency: "monthly" as const,
  interval: 1,
  dayOfMonth: 1,
  startDate: "2026-01-01",
};

async function cleanupRules(uid: string): Promise<void> {
  const { rules } = await api<{ rules: Rule[] }>({
    method: "GET",
    path: "/api/recurring-expenses",
    userId: uid,
  });
  for (const r of rules) {
    await rawFetch({
      method: "DELETE",
      path: `/api/recurring-expenses/${r.id}`,
      userId: uid,
    });
  }
}

describe("E2E: recurring-expenses status/endedAt guard regression (P1-C7)", () => {
  beforeEach(async () => {
    await ensureTestUser(userId);
    await cleanupRules(userId);
  });

  test("simulated web client (no X-Internal-Action) cannot change status across every combination", async () => {
    const { rule } = await api<{ rule: Rule }>({
      method: "POST",
      path: "/api/recurring-expenses",
      userId,
      body: baseBody,
    });
    expect(rule.status).toBe("active");

    // Try each illegal status value from a "naive" PUT call. None should
    // alter the DB row.
    for (const target of ["paused", "ended"] as const) {
      const res = await api<{ rule: Rule }>({
        method: "PUT",
        path: `/api/recurring-expenses/${rule.id}`,
        userId,
        body: { status: target, name: `rename-${target}` },
      });
      expect(res.rule.status).toBe("active");
      // Name DID change → drop is scoped to status only, not whole body.
      expect(res.rule.name).toBe(`rename-${target}`);
    }
  });

  test("simulated web client cannot move endedAt forward, backward, or null it", async () => {
    const { rule } = await api<{ rule: Rule }>({
      method: "POST",
      path: "/api/recurring-expenses",
      userId,
      body: baseBody,
    });

    // Seed endedAt = '2026-03-15' via the internal channel.
    const seedRes = await fetch(
      `http://127.0.0.1:8787/api/recurring-expenses/${rule.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WORKER_TOKEN ?? ""}`,
          "X-User-Id": userId,
          "X-Target-DB": "test",
          "X-Internal-Action": "1",
        },
        body: JSON.stringify({ endedAt: "2026-03-15" }),
      },
    );
    expect(seedRes.status).toBe(200);

    // 1. forward
    await api({
      method: "PUT",
      path: `/api/recurring-expenses/${rule.id}`,
      userId,
      body: { endedAt: "2099-01-01" },
    });
    // 2. backward
    await api({
      method: "PUT",
      path: `/api/recurring-expenses/${rule.id}`,
      userId,
      body: { endedAt: "2020-01-01" },
    });
    // 3. null
    await api({
      method: "PUT",
      path: `/api/recurring-expenses/${rule.id}`,
      userId,
      body: { endedAt: null },
    });

    const { rules } = await api<{ rules: Rule[] }>({
      method: "GET",
      path: "/api/recurring-expenses",
      userId,
    });
    expect(rules[0].endedAt).toBe("2026-03-15");
  });

  test("internal channel can move endedAt forward, backward, and back to null", async () => {
    const { rule } = await api<{ rule: Rule }>({
      method: "POST",
      path: "/api/recurring-expenses",
      userId,
      body: baseBody,
    });

    async function internalPut(payload: Record<string, unknown>): Promise<Rule> {
      const res = await fetch(
        `http://127.0.0.1:8787/api/recurring-expenses/${rule.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.WORKER_TOKEN ?? ""}`,
            "X-User-Id": userId,
            "X-Target-DB": "test",
            "X-Internal-Action": "1",
          },
          body: JSON.stringify(payload),
        },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { rule: Rule };
      return body.rule;
    }

    const ended = await internalPut({ status: "ended", endedAt: "2026-06-07" });
    expect(ended.status).toBe("ended");
    expect(ended.endedAt).toBe("2026-06-07");

    const earlier = await internalPut({ endedAt: "2026-03-15" });
    expect(earlier.endedAt).toBe("2026-03-15");

    const cleared = await internalPut({ status: "active", endedAt: null });
    expect(cleared.status).toBe("active");
    expect(cleared.endedAt).toBeNull();
  });

  test("wrong header value does not unlock the guard", async () => {
    const { rule } = await api<{ rule: Rule }>({
      method: "POST",
      path: "/api/recurring-expenses",
      userId,
      body: baseBody,
    });

    // Send `0`, `true`, empty string — none should be treated as the
    // sentinel "1". Only the exact string "1" enables the bypass.
    for (const headerVal of ["0", "true", "", "yes"]) {
      const res = await fetch(
        `http://127.0.0.1:8787/api/recurring-expenses/${rule.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.WORKER_TOKEN ?? ""}`,
            "X-User-Id": userId,
            "X-Target-DB": "test",
            "X-Internal-Action": headerVal,
          },
          body: JSON.stringify({ status: "ended" }),
        },
      );
      expect(res.status).toBe(200);
    }

    const { rules } = await api<{ rules: Rule[] }>({
      method: "GET",
      path: "/api/recurring-expenses",
      userId,
    });
    expect(rules[0].status).toBe("active");
  });
});
