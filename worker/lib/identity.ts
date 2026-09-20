export interface ExistingUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  providerAccountId: string;
}

export type IdentityResolveResult =
  | { ok: true; user: ExistingUser }
  | { ok: false; reason: "missing_email" | "unknown" | "ambiguous" };

/** Trim + lowercase. Empty after trim is missing. */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Map a verified Access email onto exactly one existing users row.
 * Never consults Access `sub`. Never creates a user.
 */
export function resolveExistingUser(
  email: string | null | undefined,
  rows: ExistingUser[],
): IdentityResolveResult {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, reason: "missing_email" };

  const matches = rows.filter((row) => normalizeEmail(row.email) === normalized);
  if (matches.length !== 1) {
    return { ok: false, reason: matches.length === 0 ? "unknown" : "ambiguous" };
  }
  return { ok: true, user: matches[0] as ExistingUser };
}

export function identityFromJwtEmail(email: unknown, rows: ExistingUser[]): IdentityResolveResult {
  if (typeof email !== "string") return { ok: false, reason: "missing_email" };
  return resolveExistingUser(email, rows);
}
