import { createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload, SignJWT } from "jose";
import { beforeAll, describe, expect, test, vi } from "vitest";

const { mockCreateRemoteJWKSet } = vi.hoisted(() => ({
  mockCreateRemoteJWKSet: vi.fn(),
}));

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    createRemoteJWKSet: mockCreateRemoteJWKSet,
  };
});

import { accessIssuer, verifyAccessJwt } from "../lib/access-jwt";

const TEAM = "nocoo";
const AUD = "19d100ea22080f644154aad7b35785c1381874d27dec7fd238a2cb8fd7d640ee";
const ISSUER = "https://nocoo.cloudflareaccess.com";

let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  otherPrivateKey = other.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwk.kid = "test-kid";
  jwk.alg = "RS256";
  mockCreateRemoteJWKSet.mockReturnValue(createLocalJWKSet({ keys: [jwk] }));
});

async function sign(
  claims: JWTPayload,
  key = privateKey,
  extra: { exp?: string | number; iss?: string; aud?: string } = {},
) {
  return new SignJWT({ email: "owner@example.com", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
    .setIssuer(extra.iss ?? ISSUER)
    .setAudience(extra.aud ?? AUD)
    .setExpirationTime(extra.exp ?? "5m")
    .setSubject(typeof claims.sub === "string" ? claims.sub : "access-sub")
    .sign(key);
}

describe("accessIssuer", () => {
  test("maps team name to cloudflareaccess host", () => {
    expect(accessIssuer(TEAM)).toBe(ISSUER);
    expect(accessIssuer(" nocoo ")).toBe(ISSUER);
  });

  test("keeps an explicit hostname", () => {
    expect(accessIssuer("https://nocoo.cloudflareaccess.com/")).toBe(ISSUER);
    expect(accessIssuer("example.cloudflareaccess.com")).toBe(
      "https://example.cloudflareaccess.com",
    );
  });
});

describe("verifyAccessJwt", () => {
  test("accepts a valid RS256 token with iss/aud/exp/sub/email", async () => {
    const token = await sign({ sub: "access-sub", email: "Owner@example.com" });
    const payload = await verifyAccessJwt(token, ISSUER, AUD);
    expect(payload.email).toBe("Owner@example.com");
    expect(payload.sub).toBe("access-sub");
    expect(mockCreateRemoteJWKSet).toHaveBeenCalled();
    const url = mockCreateRemoteJWKSet.mock.calls[0]?.[0] as URL;
    expect(String(url)).toBe(`${ISSUER}/cdn-cgi/access/certs`);
  });

  test("rejects wrong issuer", async () => {
    const token = await sign({ sub: "access-sub" }, privateKey, { iss: "https://evil.example" });
    await expect(verifyAccessJwt(token, ISSUER, AUD)).rejects.toThrow();
  });

  test("rejects wrong audience", async () => {
    const token = await sign({ sub: "access-sub" }, privateKey, { aud: "other-aud" });
    await expect(verifyAccessJwt(token, ISSUER, AUD)).rejects.toThrow();
  });

  test("rejects expired token", async () => {
    const token = await sign({ sub: "access-sub" }, privateKey, { exp: "0s" });
    await expect(verifyAccessJwt(token, ISSUER, AUD)).rejects.toThrow();
  });

  test("rejects bad signature", async () => {
    const token = await sign({ sub: "access-sub" }, otherPrivateKey);
    await expect(verifyAccessJwt(token, ISSUER, AUD)).rejects.toThrow();
  });

  test("rejects missing email claim", async () => {
    const token = await new SignJWT({ sub: "access-sub" })
      .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
      .setIssuer(ISSUER)
      .setAudience(AUD)
      .setExpirationTime("5m")
      .setSubject("access-sub")
      .sign(privateKey);
    await expect(verifyAccessJwt(token, ISSUER, AUD)).rejects.toThrow();
  });

  test("reuses JWKS for the same issuer", async () => {
    mockCreateRemoteJWKSet.mockClear();
    const token = await sign({ sub: "access-sub" });
    await verifyAccessJwt(token, ISSUER, AUD);
    await verifyAccessJwt(token, ISSUER, AUD);
    expect(mockCreateRemoteJWKSet).not.toHaveBeenCalled();
  });
});
