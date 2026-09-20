import { describe, expect, test } from "vitest";
import {
  type ExistingUser,
  identityFromJwtEmail,
  normalizeEmail,
  resolveExistingUser,
} from "../lib/identity";

const googleEra: ExistingUser = {
  id: "google-sub-original",
  email: "Owner@Example.com",
  name: "Owner",
  image: null,
  providerAccountId: "google-sub-original",
};

describe("normalizeEmail", () => {
  test("trims and lowercases", () => {
    expect(normalizeEmail("  Owner@Example.com ")).toBe("owner@example.com");
  });

  test("missing values are null", () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail(1 as unknown as string)).toBeNull();
  });
});

describe("resolveExistingUser", () => {
  test("maps normalized email onto the Google-era id", () => {
    const result = resolveExistingUser(" owner@example.com ", [googleEra]);
    expect(result).toEqual({ ok: true, user: googleEra });
    if (result.ok) expect(result.user.id).toBe("google-sub-original");
  });

  test("unknown email is denied", () => {
    expect(resolveExistingUser("other@example.com", [googleEra])).toEqual({
      ok: false,
      reason: "unknown",
    });
  });

  test("ambiguous email is denied", () => {
    const duplicate: ExistingUser = { ...googleEra, id: "other-id", providerAccountId: "other" };
    expect(resolveExistingUser("owner@example.com", [googleEra, duplicate])).toEqual({
      ok: false,
      reason: "ambiguous",
    });
  });

  test("missing email is denied", () => {
    expect(resolveExistingUser("  ", [googleEra])).toEqual({ ok: false, reason: "missing_email" });
  });
});

describe("identityFromJwtEmail", () => {
  test("requires a string email claim", () => {
    expect(identityFromJwtEmail(undefined, [googleEra])).toEqual({
      ok: false,
      reason: "missing_email",
    });
    expect(identityFromJwtEmail("owner@example.com", [googleEra]).ok).toBe(true);
  });
});
