import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/terms", "/privacy"];

// Public route prefixes
const PUBLIC_PREFIXES = [
  "/.well-known/", // OAuth metadata
  "/api/mcp", // MCP OAuth endpoints (has its own Bearer token auth)
  "/api/auth/", // NextAuth endpoints handle their own auth
  "/api/live", // Public health check
];

function isPublicRoute(pathname: string): boolean {
  // Exact matches
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  // Prefix matches
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isProtectedApiRoute(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  // Auth API routes handle auth themselves
  if (pathname.startsWith("/api/auth/")) return false;
  // MCP has its own Bearer token auth
  if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")) return false;
  // All other API routes require auth
  return true;
}

// Build redirect URL respecting reverse proxy headers
function buildLoginUrl(req: NextRequest, callbackPath: string): URL {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";

  let baseUrl: string;
  if (forwardedHost) {
    baseUrl = `${forwardedProto}://${forwardedHost}`;
  } else {
    baseUrl = req.nextUrl.origin;
  }

  const url = new URL("/login", baseUrl);
  url.searchParams.set("callbackUrl", callbackPath);
  return url;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and Next.js internals
  if (pathname.startsWith("/_next/") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Public routes - no auth check needed
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // API routes have their own auth handling
  if (isProtectedApiRoute(pathname)) {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Protected page routes - require session
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(buildLoginUrl(request, pathname));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$).*)",
  ],
};
