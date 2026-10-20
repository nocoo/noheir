import { describe, expect, test } from "vitest";
import { api, rawFetch, TEST_USER_A, TEST_USER_C } from "./helpers/client";

const userId = TEST_USER_C;
const base = {
  name: "state-regression",
  amountCents: 100_000,
  frequency: "monthly",
  interval: 1,
  dayOfMonth: 1,
  startDate: "2026-01-01",
};
interface Rule {
  id: string;
  version: number;
  status: "active" | "paused" | "ended";
  endedAt: string | null;
  name: string;
}
const create = () =>
  api<{ rule: Rule }>({ path: "/api/recurring-expenses", method: "POST", userId, body: base });
const transition = (rule: Rule, action: string, owner = userId) =>
  rawFetch({
    path: `/api/recurring-expenses/${rule.id}/state`,
    method: "POST",
    version: rule.version,
    userId: owner,
    body: { transition: action },
  });
async function getRule(id: string) {
  const { rules } = await api<{ rules: Rule[] }>({ path: "/api/recurring-expenses", userId });
  const rule = rules.find((r) => r.id === id);
  if (!rule) throw new Error("Rule missing");
  return rule;
}

describe("Recurring expense state authority", () => {
  test("generic updates cannot forge state with any internal header", async () => {
    const { rule } = await create();
    for (const value of ["1", "0", "true", ""]) {
      const response = await rawFetch({
        path: `/api/recurring-expenses/${rule.id}`,
        method: "PUT",
        version: rule.version,
        userId,
        headers: { "X-Internal-Action": value },
        body: { name: "renamed", status: "ended", endedAt: "2099-01-01" },
      });
      expect(response.status).toBe(400);
      expect(await getRule(rule.id)).toMatchObject({
        status: "active",
        endedAt: null,
        name: base.name,
      });
    }
  });
  test("pause, resume and end follow the legal transition matrix", async () => {
    const { rule } = await create();
    expect((await transition(rule, "resume")).status).toBe(409);
    expect((await transition(rule, "pause")).status).toBe(200);
    const paused = await getRule(rule.id);
    expect(paused).toMatchObject({ status: "paused", endedAt: null });
    expect((await transition(paused, "pause")).status).toBe(409);
    expect((await transition(paused, "resume")).status).toBe(200);
    const resumed = await getRule(rule.id);
    expect((await transition(resumed, "end")).status).toBe(200);
    const ended = await getRule(rule.id);
    expect(ended.status).toBe("ended");
    expect(ended.endedAt).toBe(new Date().toISOString().slice(0, 10));
    for (const action of ["pause", "resume", "end"])
      expect((await transition(ended, action)).status).toBe(409);
    const forged = await rawFetch({
      path: `/api/recurring-expenses/${rule.id}`,
      method: "PUT",
      version: ended.version,
      userId,
      headers: { "X-Internal-Action": "1" },
      body: { endedAt: null, status: "active" },
    });
    expect(forged.status).toBe(400);
    expect(await getRule(rule.id)).toMatchObject({ status: "ended", endedAt: ended.endedAt });
  });
  test("paused rules may end, invalid and cross-user transitions do not write", async () => {
    const { rule } = await create();
    expect((await transition(rule, "pause", TEST_USER_A)).status).toBe(404);
    expect((await transition(rule, "invalid")).status).toBe(400);
    expect((await transition(rule, "pause")).status).toBe(200);
    expect((await transition(await getRule(rule.id), "end")).status).toBe(200);
  });
  test("concurrent duplicate transitions have only one winner", async () => {
    const { rule } = await create();
    const results = await Promise.all([transition(rule, "pause"), transition(rule, "pause")]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => [409, 412].includes(r.status))).toHaveLength(1);
  });
});
