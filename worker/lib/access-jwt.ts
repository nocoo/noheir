import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function accessIssuer(teamDomain: string): string {
  const host = teamDomain
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (host.includes(".")) return `https://${host}`;
  return `https://${host}.cloudflareaccess.com`;
}

function jwksForIssuer(issuer: string) {
  const existing = jwksByIssuer.get(issuer);
  if (existing) return existing;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  jwksByIssuer.set(issuer, jwks);
  return jwks;
}

/** Verify an Access JWT with jose (RS256, JWKS, iss/aud/exp/sub/email). */
export async function verifyAccessJwt(
  token: string,
  issuer: string,
  audience: string,
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, jwksForIssuer(issuer), {
    issuer,
    audience,
    algorithms: ["RS256"],
    requiredClaims: ["sub", "email", "exp"],
  });
  return payload;
}
