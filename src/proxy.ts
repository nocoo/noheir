import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveProxyAction, type ProxyAction } from "@/lib/proxy-logic";

// Build redirect URL respecting reverse proxy headers
function buildRedirectUrl(req: NextRequest, pathname: string): URL {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";

  if (forwardedHost) {
    return new URL(pathname, `${forwardedProto}://${forwardedHost}`);
  }

  return new URL(pathname, req.nextUrl.origin);
}

/** Convert a ProxyAction into a NextResponse */
function actionToResponse(action: ProxyAction, req: NextRequest): NextResponse {
  switch (action.type) {
    case "next":
      return NextResponse.next();
    case "redirect":
      return NextResponse.redirect(buildRedirectUrl(req, action.to));
    case "json":
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// Next.js 16 proxy convention (replaces middleware.ts)
const authHandler = auth(async (req) => {
  const pathname = req.nextUrl.pathname;

  // Allow auth routes (OAuth flow)
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;
  const action = resolveProxyAction({ isLoggedIn, pathname });
  return actionToResponse(action, req);
});

// Export as named 'proxy' function for Next.js 16
export function proxy(request: NextRequest) {
  return authHandler(request, {} as never);
}

export const config = {
  matcher: [
    // Match all paths except static files and health check
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$|api/live).*)",
  ],
};
