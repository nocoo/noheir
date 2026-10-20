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

export type PublicRouteKind = "live" | "none";

export function publicRouteKind(method: string, path: string): PublicRouteKind {
  const m = method.toUpperCase();
  const normalized = path.replace(/\/+$/, "") || "/";

  if (m === "GET" && normalized === "/api/live") return "live";
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
