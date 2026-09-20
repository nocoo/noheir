const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export const MCP_ISSUER = "https://noheir.hexly.ai";

export type EnvironmentName = "production" | "local" | "test" | string;

export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  return LOOPBACK_HOSTS.has(host);
}

export function isLocalOrTestEnvironment(environment: string | undefined): boolean {
  return environment === "local" || environment === "test";
}

/**
 * Local identity bypass: explicit local/test env AND loopback request host
 * AND a configured LOCAL_USER_EMAIL. Production never qualifies.
 */
export function isLocalBypassAllowed(input: {
  environment: string | undefined;
  hostname: string;
  localUserEmail: string | undefined;
}): boolean {
  if (!isLocalOrTestEnvironment(input.environment)) return false;
  if (!isLoopbackHostname(input.hostname)) return false;
  return Boolean(input.localUserEmail?.trim());
}

export function isMutatingMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Same-origin check for authenticated browser mutations. Fail closed. */
export function isSameOriginRequest(input: {
  origin: string | null;
  referer: string | null;
  siteUrl: string;
}): boolean {
  const siteOrigin = originOf(input.siteUrl);
  if (!siteOrigin) return false;
  if (input.origin) return input.origin === siteOrigin;
  if (input.referer) {
    const refererOrigin = originOf(input.referer);
    return refererOrigin === siteOrigin;
  }
  return false;
}

export type PublicRouteKind = "live" | "legal" | "mcp-machine" | "well-known" | "none";

/**
 * Exact public paths. Never treat `/api/mcp/*` as a prefix bypass.
 * authorize/callback are NOT public.
 */
export function publicRouteKind(method: string, path: string): PublicRouteKind {
  const m = method.toUpperCase();
  const normalized = path.replace(/\/+$/, "") || "/";

  if (m === "GET" && normalized === "/api/live") return "live";
  if (m === "GET" && (normalized === "/terms" || normalized === "/privacy")) return "legal";
  if (m === "GET" && normalized === "/.well-known/oauth-authorization-server") return "well-known";

  if (m === "POST" && normalized === "/api/mcp") return "mcp-machine";
  if (m === "POST" && normalized === "/api/mcp/register") return "mcp-machine";
  if (m === "POST" && normalized === "/api/mcp/token") return "mcp-machine";
  if (m === "POST" && normalized === "/api/mcp/revoke") return "mcp-machine";

  return "none";
}

export function isPublicRoute(method: string, path: string): boolean {
  return publicRouteKind(method, path) !== "none";
}

export function isApiPath(path: string): boolean {
  return path === "/api" || path.startsWith("/api/") || path.startsWith("/.well-known/");
}

export function extractAccessJwt(request: Request): string | null {
  const header = request.headers.get("Cf-Access-Jwt-Assertion");
  if (header?.trim()) return header.trim();
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
