import { describe, expect, test } from "vitest";
import {
  extractAccessJwt,
  isApiPath,
  isLocalBypassAllowed,
  isLocalOrTestEnvironment,
  isLoopbackHostname,
  isMutatingMethod,
  isPublicRoute,
  isSameOriginRequest,
  publicRouteKind,
} from "../lib/request-policy";

describe("local bypass", () => {
  test("production never bypasses, even on loopback with LOCAL_USER_EMAIL", () => {
    expect(
      isLocalBypassAllowed({
        environment: "production",
        hostname: "localhost",
        localUserEmail: "owner@example.com",
      }),
    ).toBe(false);
    expect(isLocalOrTestEnvironment("production")).toBe(false);
  });

  test("requires local/test + loopback + configured email", () => {
    expect(
      isLocalBypassAllowed({
        environment: "local",
        hostname: "localhost",
        localUserEmail: "owner@example.com",
      }),
    ).toBe(true);
    expect(
      isLocalBypassAllowed({
        environment: "test",
        hostname: "127.0.0.1",
        localUserEmail: "owner@example.com",
      }),
    ).toBe(true);
    expect(
      isLocalBypassAllowed({
        environment: "local",
        hostname: "noheir.hexly.ai",
        localUserEmail: "owner@example.com",
      }),
    ).toBe(false);
    expect(
      isLocalBypassAllowed({ environment: "local", hostname: "localhost", localUserEmail: "  " }),
    ).toBe(false);
  });

  test("loopback hostnames", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("[::1]")).toBe(true);
    expect(isLoopbackHostname("::1")).toBe(true);
    expect(isLoopbackHostname("example.com")).toBe(false);
  });
});

describe("public routes", () => {
  test("live, well-known, and exact MCP machine paths only", () => {
    expect(publicRouteKind("GET", "/api/live")).toBe("live");
    expect(publicRouteKind("GET", "/terms")).toBe("none");
    expect(publicRouteKind("GET", "/privacy")).toBe("none");
    expect(publicRouteKind("GET", "/.well-known/oauth-authorization-server")).toBe("well-known");
    expect(publicRouteKind("POST", "/api/mcp")).toBe("mcp-machine");
    expect(publicRouteKind("POST", "/api/mcp/register")).toBe("mcp-machine");
    expect(publicRouteKind("POST", "/api/mcp/token")).toBe("mcp-machine");
    expect(publicRouteKind("POST", "/api/mcp/revoke")).toBe("mcp-machine");
  });

  test("does not treat /api/mcp/* as a prefix bypass", () => {
    expect(isPublicRoute("GET", "/api/mcp")).toBe(false);
    expect(isPublicRoute("GET", "/api/mcp/authorize")).toBe(false);
    expect(isPublicRoute("GET", "/api/mcp/callback")).toBe(false);
    expect(isPublicRoute("POST", "/api/mcp/authorize")).toBe(false);
    expect(isPublicRoute("GET", "/api/transactions")).toBe(false);
  });

  test("api path detection", () => {
    expect(isApiPath("/api/live")).toBe(true);
    expect(isApiPath("/.well-known/oauth-authorization-server")).toBe(true);
    expect(isApiPath("/terms")).toBe(false);
  });

  test("strips trailing slashes down to root", () => {
    expect(publicRouteKind("GET", "/")).toBe("none");
    expect(publicRouteKind("GET", "///")).toBe("none");
  });
});

describe("csrf / jwt extraction", () => {
  test("mutating methods require same origin", () => {
    expect(isMutatingMethod("POST")).toBe(true);
    expect(isMutatingMethod("get")).toBe(false);
    expect(
      isSameOriginRequest({
        origin: "https://noheir.hexly.ai",
        referer: null,
        siteUrl: "https://noheir.hexly.ai",
      }),
    ).toBe(true);
    expect(
      isSameOriginRequest({
        origin: null,
        referer: "https://noheir.hexly.ai/account",
        siteUrl: "https://noheir.hexly.ai",
      }),
    ).toBe(true);
    expect(
      isSameOriginRequest({
        origin: "https://evil.example",
        referer: null,
        siteUrl: "https://noheir.hexly.ai",
      }),
    ).toBe(false);
    expect(
      isSameOriginRequest({ origin: null, referer: null, siteUrl: "https://noheir.hexly.ai" }),
    ).toBe(false);
    expect(isSameOriginRequest({ origin: "https://x", referer: null, siteUrl: "not-a-url" })).toBe(
      false,
    );
  });

  test("reads Access JWT from header or CF_Authorization cookie", () => {
    const header = extractAccessJwt(
      new Request("https://noheir.hexly.ai/", {
        headers: { "Cf-Access-Jwt-Assertion": " header-token " },
      }),
    );
    expect(header).toBe("header-token");
    const cookie = extractAccessJwt(
      new Request("https://noheir.hexly.ai/", {
        headers: { Cookie: "a=1; CF_Authorization=cookie%2Dtoken; b=2" },
      }),
    );
    expect(cookie).toBe("cookie-token");
    expect(extractAccessJwt(new Request("https://noheir.hexly.ai/"))).toBeNull();
    expect(
      extractAccessJwt(new Request("https://noheir.hexly.ai/", { headers: { Cookie: "other=1" } })),
    ).toBeNull();
    expect(
      extractAccessJwt(
        new Request("https://noheir.hexly.ai/", { headers: { Cookie: "CF_Authorization=" } }),
      ),
    ).toBeNull();
  });

  test("falls back when cookie is not URI-decodable", () => {
    const raw = extractAccessJwt(
      new Request("https://noheir.hexly.ai/", {
        headers: { Cookie: "CF_Authorization=%E0%A4%A" },
      }),
    );
    expect(raw).toBe("%E0%A4%A");
  });
});
