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
  status: "active" | "paused" | "ended";
  endedAt: string | null;
  name: string;
}
const create = () =>
  api<{ rule: Rule }>({ path: "/api/recurring-expenses", method: "POST", userId, body: base });
const transition = (id: string, action: string, owner = userId) =>
  rawFetch({
    path: `/api/recurring-expenses/${id}/state`,
    method: "POST",
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
        userId,
        headers: { "X-Internal-Action": value },
        body: { name: "renamed", status: "ended", endedAt: "2099-01-01" },
      });
      expect(response.status).toBe(200);
      expect(await getRule(rule.id)).toMatchObject({
        status: "active",
        endedAt: null,
        name: "renamed",
      });
    }
  });
  test("pause, resume and end follow the legal transition matrix", async () => {
    const { rule } = await create();
    expect((await transition(rule.id, "resume")).status).toBe(409);
    expect((await transition(rule.id, "pause")).status).toBe(200);
    expect(await getRule(rule.id)).toMatchObject({ status: "paused", endedAt: null });
    expect((await transition(rule.id, "pause")).status).toBe(409);
    expect((await transition(rule.id, "resume")).status).toBe(200);
    expect((await transition(rule.id, "end")).status).toBe(200);
    const ended = await getRule(rule.id);
    expect(ended.status).toBe("ended");
    expect(ended.endedAt).toBe(new Date().toISOString().slice(0, 10));
    for (const action of ["pause", "resume", "end"])
      expect((await transition(rule.id, action)).status).toBe(409);
    await api({
      path: `/api/recurring-expenses/${rule.id}`,
      method: "PUT",
      userId,
      headers: { "X-Internal-Action": "1" },
      body: { endedAt: null, status: "active" },
    });
    expect(await getRule(rule.id)).toMatchObject({ status: "ended", endedAt: ended.endedAt });
  });
  test("paused rules may end, invalid and cross-user transitions do not write", async () => {
    const { rule } = await create();
    expect((await transition(rule.id, "pause", TEST_USER_A)).status).toBe(404);
    expect((await transition(rule.id, "invalid")).status).toBe(400);
    expect((await transition(rule.id, "pause")).status).toBe(200);
    expect((await transition(rule.id, "end")).status).toBe(200);
  });
  test("concurrent duplicate transitions have only one winner", async () => {
    const { rule } = await create();
    const results = await Promise.all([transition(rule.id, "pause"), transition(rule.id, "pause")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });
});
