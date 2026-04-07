// ---------------------------------------------------------------------------
// OAuth 2.1 PKCE and Token Utilities
// Inlined from @nocoo/base-mcp/auth for deployment compatibility
// ---------------------------------------------------------------------------

/**
 * Verify a PKCE S256 code_challenge against a code_verifier.
 *
 * The code_challenge is created by: base64url(sha256(code_verifier))
 * We recompute this from the verifier and compare.
 */
export async function verifyPkceS256(
  codeVerifier: string,
  codeChallenge: string,
): Promise<boolean> {
  if (!codeVerifier || !codeChallenge) return false;

  const encoded = new TextEncoder().encode(codeVerifier);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  const base64url = btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return base64url === codeChallenge;
}

/**
 * Check if a redirect URI is a loopback address (allowed for native apps).
 *
 * Per RFC 8252, native apps can use http:// with loopback addresses:
 * - localhost
 * - 127.0.0.1
 * - [::1]
 */
export function isLoopbackRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.protocol !== "http:") return false;
    const host = url.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

/**
 * Generate a secure random token.
 *
 * @param length - Number of random bytes (default 32, produces 64 hex chars)
 * @returns Hex-encoded random token
 */
export function generateToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
