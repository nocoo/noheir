import { accessIssuer, verifyAccessJwt } from "../lib/access-jwt";
import {
  type ExistingUser,
  identityFromJwtEmail,
  normalizeEmail,
  resolveExistingUser,
} from "../lib/identity";
import {
  extractAccessJwt,
  isLocalBypassAllowed,
  isMutatingMethod,
  isSameOriginRequest,
} from "../lib/request-policy";
import type { Env } from "./env";

export type AccessFailure = "unauthenticated" | "forbidden" | "misconfigured" | "csrf";

export async function authenticateRequest(
  request: Request,
  env: Env,
  lookupEmail: (email: string) => Promise<ExistingUser[]>,
): Promise<{ ok: true; user: ExistingUser } | { ok: false; reason: AccessFailure }> {
  const url = new URL(request.url);

  if (
    isLocalBypassAllowed({
      environment: env.ENVIRONMENT,
      hostname: url.hostname,
      localUserEmail: env.LOCAL_USER_EMAIL,
    })
  ) {
    const email = normalizeEmail(env.LOCAL_USER_EMAIL);
    if (!email) return { ok: false, reason: "unauthenticated" };
    const rows = await lookupEmail(email);
    const resolved = resolveExistingUser(email, rows);
    if (!resolved.ok) return { ok: false, reason: "forbidden" };
    const csrf = mutationCsrfFailure(request, env);
    if (csrf) return csrf;
    return { ok: true, user: resolved.user };
  }

  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
    return { ok: false, reason: "misconfigured" };
  }

  const token = extractAccessJwt(request);
  if (!token) return { ok: false, reason: "unauthenticated" };

  try {
    const payload = await verifyAccessJwt(
      token,
      accessIssuer(env.CF_ACCESS_TEAM_DOMAIN),
      env.CF_ACCESS_AUD,
    );
    const rows = await lookupEmail(typeof payload.email === "string" ? payload.email : "");
    const resolved = identityFromJwtEmail(payload.email, rows);
    if (!resolved.ok) return { ok: false, reason: "forbidden" };
    const csrf = mutationCsrfFailure(request, env);
    if (csrf) return csrf;
    return { ok: true, user: resolved.user };
  } catch {
    return { ok: false, reason: "unauthenticated" };
  }
}

function mutationCsrfFailure(request: Request, env: Env): { ok: false; reason: "csrf" } | null {
  if (!isMutatingMethod(request.method)) return null;
  if (
    isSameOriginRequest({
      origin: request.headers.get("Origin"),
      referer: request.headers.get("Referer"),
      siteUrl: env.SITE_URL,
    })
  ) {
    return null;
  }
  return { ok: false, reason: "csrf" };
}
