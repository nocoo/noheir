import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ExistingUser } from "../lib/identity";
import type { Env } from "../src/env";

const { mockVerify } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
}));

vi.mock("../lib/access-jwt", () => ({
  accessIssuer: (team: string) =>
    team.includes(".") ? `https://${team}` : `https://${team}.cloudflareaccess.com`,
  verifyAccessJwt: mockVerify,
}));

import { authenticateRequest } from "../src/access";

const owner: ExistingUser = {
  id: "google-sub-original",
  email: "owner@example.com",
  name: "Owner",
  image: null,
  providerAccountId: "google-sub-original",
};

function env(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as Env["DB"],
    CF_ACCESS_TEAM_DOMAIN: "nocoo",
    CF_ACCESS_AUD: "19d100ea22080f644154aad7b35785c1381874d27dec7fd238a2cb8fd7d640ee",
    SITE_URL: "https://noheir.hexly.ai",
    ENVIRONMENT: "production",
    LOCAL_USER_EMAIL: "owner@example.com",
    BUILD_SHA: "",
    ...overrides,
  };
}

describe("authenticateRequest", () => {
  beforeEach(() => {
    mockVerify.mockReset();
  });

  test("production has no local bypass even on loopback", async () => {
    const request = new Request("http://localhost/api/transactions");
    const result = await authenticateRequest(request, env(), async () => [owner]);
    expect(result).toEqual({ ok: false, reason: "unauthenticated" });
    expect(mockVerify).not.toHaveBeenCalled();
  });

  test("local bypass requires local env, loopback, and a unique existing user", async () => {
    const local = env({ ENVIRONMENT: "local" });
    const ok = await authenticateRequest(
      new Request("http://127.0.0.1/api/live"),
      local,
      async (email) => {
        expect(email).toBe("owner@example.com");
        return [owner];
      },
    );
    expect(ok).toEqual({ ok: true, user: owner });

    const unknown = await authenticateRequest(
      new Request("http://localhost/api/live"),
      local,
      async () => [],
    );
    expect(unknown).toEqual({ ok: false, reason: "forbidden" });

    const ambiguous = await authenticateRequest(
      new Request("http://localhost/api/live"),
      local,
      async () => [owner, { ...owner, id: "other" }],
    );
    expect(ambiguous).toEqual({ ok: false, reason: "forbidden" });
  });

  test("missing Access config is misconfigured", async () => {
    const result = await authenticateRequest(
      new Request("https://noheir.hexly.ai/api/transactions"),
      env({ CF_ACCESS_TEAM_DOMAIN: "", CF_ACCESS_AUD: "" }),
      async () => [owner],
    );
    expect(result).toEqual({ ok: false, reason: "misconfigured" });
  });

  test("unknown and ambiguous JWT emails are forbidden; bad signatures unauthenticated", async () => {
    mockVerify.mockResolvedValueOnce({ email: "missing@example.com", sub: "s" });
    const unknown = await authenticateRequest(
      new Request("https://noheir.hexly.ai/", {
        headers: { "Cf-Access-Jwt-Assertion": "token" },
      }),
      env(),
      async () => [],
    );
    expect(unknown).toEqual({ ok: false, reason: "forbidden" });

    mockVerify.mockResolvedValueOnce({ email: "owner@example.com", sub: "s" });
    const ambiguous = await authenticateRequest(
      new Request("https://noheir.hexly.ai/", {
        headers: { "Cf-Access-Jwt-Assertion": "token" },
      }),
      env(),
      async () => [owner, { ...owner, id: "dup" }],
    );
    expect(ambiguous).toEqual({ ok: false, reason: "forbidden" });

    mockVerify.mockRejectedValueOnce(new Error("bad sig"));
    const bad = await authenticateRequest(
      new Request("https://noheir.hexly.ai/", {
        headers: { "Cf-Access-Jwt-Assertion": "token" },
      }),
      env(),
      async () => [owner],
    );
    expect(bad).toEqual({ ok: false, reason: "unauthenticated" });
  });

  test("verified email preserves the Google-era user id", async () => {
    mockVerify.mockResolvedValueOnce({
      email: "Owner@Example.com",
      sub: "access-sub-must-not-replace",
    });
    const result = await authenticateRequest(
      new Request("https://noheir.hexly.ai/", {
        headers: { "Cf-Access-Jwt-Assertion": "token" },
      }),
      env(),
      async () => [owner],
    );
    expect(result).toEqual({ ok: true, user: owner });
    if (result.ok) expect(result.user.id).toBe("google-sub-original");
  });

  test("mutations without same-origin fail closed", async () => {
    mockVerify.mockResolvedValue({ email: "owner@example.com", sub: "s" });
    const csrf = await authenticateRequest(
      new Request("https://noheir.hexly.ai/api/transactions", {
        method: "POST",
        headers: { "Cf-Access-Jwt-Assertion": "token", Origin: "https://evil.example" },
      }),
      env(),
      async () => [owner],
    );
    expect(csrf).toEqual({ ok: false, reason: "csrf" });

    const ok = await authenticateRequest(
      new Request("https://noheir.hexly.ai/api/transactions", {
        method: "POST",
        headers: {
          "Cf-Access-Jwt-Assertion": "token",
          Origin: "https://noheir.hexly.ai",
        },
      }),
      env(),
      async () => [owner],
    );
    expect(ok).toEqual({ ok: true, user: owner });
  });

  test("local bypass also enforces CSRF on mutations", async () => {
    const result = await authenticateRequest(
      new Request("http://localhost/api/transactions", {
        method: "POST",
        headers: { Origin: "https://evil.example" },
      }),
      env({ ENVIRONMENT: "local" }),
      async () => [owner],
    );
    expect(result).toEqual({ ok: false, reason: "csrf" });
  });

  test("empty local email is unauthenticated", async () => {
    const result = await authenticateRequest(
      new Request("http://localhost/"),
      env({ ENVIRONMENT: "local", LOCAL_USER_EMAIL: "  " }),
      async () => [owner],
    );
    expect(result.ok).toBe(false);
  });
});
