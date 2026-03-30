/**
 * Pure decision logic extracted from proxy.ts for testability.
 *
 * noheir uses simple auth (no 2FA), so the decision table is:
 * - Logged in on /login → redirect to /
 * - Not logged in (except /login) → redirect to /login (or 401 for API)
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

export function resolveProxyAction(ctx: ProxyContext): ProxyAction {
  const isApiRoute = ctx.pathname.startsWith("/api/");
  const isLoginPage = ctx.pathname === "/login";

  // Redirect to home if logged in and on login page
  if (isLoginPage && ctx.isLoggedIn) {
    return { type: "redirect", to: "/" };
  }

  // Not authenticated — block access
  if (!isLoginPage && !ctx.isLoggedIn) {
    if (isApiRoute) {
      return { type: "json", status: 401 };
    }
    return { type: "redirect", to: "/login" };
  }

  return { type: "next" };
}
