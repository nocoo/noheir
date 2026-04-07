/**
 * MCP OAuth Callback Endpoint
 *
 * Called after user login, generates auth code and redirects to client.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { getAuthSessionByState, upgradeAuthSession } from "@/services/mcp-auth-codes";
import { generateToken } from "@nocoo/base-mcp/auth";

// Check if email is in allowed list
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function isEmailAllowed(email: string): boolean {
  if (allowedEmails.length === 0) return true;
  return allowedEmails.includes(email.toLowerCase());
}

function errorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get("state");

    if (!state) {
      return errorResponse("Missing state parameter");
    }

    // Get user session
    const session = await auth();
    const siteUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    if (!session?.user?.id || !session?.user?.email) {
      // Redirect to login with callback
      const callbackUrl = `${siteUrl}/api/mcp/callback?state=${encodeURIComponent(state)}`;
      const loginUrl = new URL("/login", siteUrl);
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(loginUrl.toString());
    }

    // Verify email is allowed
    if (!isEmailAllowed(session.user.email)) {
      return errorResponse("Email not authorized", 403);
    }

    // Look up authorization session by state
    const db = getDb();
    const authSession = await getAuthSessionByState(db, state);
    if (!authSession) {
      return errorResponse("Invalid or expired authorization session");
    }

    // Generate authorization code (64 hex chars = 32 bytes)
    const code = generateToken(32);

    // Upgrade session with code and user ID
    const upgraded = await upgradeAuthSession(db, state, code, session.user.id);
    if (!upgraded) {
      return errorResponse("Authorization session already used or expired");
    }

    // Redirect to client's redirect_uri with code and state
    const redirectUrl = new URL(authSession.redirect_uri);
    redirectUrl.searchParams.set("code", code);
    redirectUrl.searchParams.set("state", state);

    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("[mcp/callback] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
