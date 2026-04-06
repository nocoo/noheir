/**
 * Pure decision logic extracted from proxy.ts for testability.
 *
 * noheir uses simple auth (no 2FA), so the decision table:
 * - Public paths (/.well-known/*, /login, /terms, /privacy) → allow
 * - Logged in on /login → redirect to /
 * - Not logged in (except public) → redirect to /login (or 401 for API)
 * - Otherwise → allow through
 */

export type ProxyAction =
  | { type: "next" }
  | { type: "redirect"; to: "/" | "/login" }
  | { type: "json"; status: 401 };

export interface ProxyContext {
  isLoggedIn: boolean;
  pathname: string;
}

/** Paths that should be publicly accessible without authentication */
const PUBLIC_PATHS = [
  "/login",
  "/terms",
  "/privacy",
  "/.well-known/",  // OAuth metadata, etc.
  "/api/mcp/",      // MCP OAuth endpoints (register, authorize, token, etc.)
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p));
}

export function resolveProxyAction(ctx: ProxyContext): ProxyAction {
  const isApiRoute = ctx.pathname.startsWith("/api/");
  const isLoginPage = ctx.pathname === "/login";
  const isPublic = isPublicPath(ctx.pathname);

  // Redirect to home if logged in and on login page
  if (isLoginPage && ctx.isLoggedIn) {
    return { type: "redirect", to: "/" };
  }

  // Allow public paths without authentication
  if (isPublic) {
    return { type: "next" };
  }

  // Not authenticated — block access
  if (!ctx.isLoggedIn) {
    if (isApiRoute) {
      return { type: "json", status: 401 };
    }
    return { type: "redirect", to: "/login" };
  }

  return { type: "next" };
}
