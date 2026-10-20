import {
  API_RESOURCES,
  type ApiKeyInfo,
  type ApiScope,
  apiKeyCreateSchema,
} from "@/domain/api-contract";

const financialReads = API_RESOURCES.filter((resource) => resource !== "analyses").map(
  (resource) => `${resource}:read` as ApiScope,
);
export const KEY_PRESETS = {
  analyst: financialReads,
  reports: [...financialReads, "analyses:read", "analyses:write"] as ApiScope[],
  bookkeeper: [
    "transactions:read",
    "transactions:write",
    "transfers:read",
    "transfers:write",
    "expense-categories:read",
    "recurring-expenses:read",
    "recurring-expenses:write",
  ] as ApiScope[],
};

export function buildKeyInput(label: string, scopes: ApiScope[], days: string) {
  return apiKeyCreateSchema.parse({ label, scopes, expiresInDays: Number(days) });
}
export function toggleScope(scopes: ApiScope[], scope: ApiScope): ApiScope[] {
  return scopes.includes(scope) ? scopes.filter((value) => value !== scope) : [...scopes, scope];
}
export function getKeyStatus(key: ApiKeyInfo, now = Date.now()): "active" | "expired" | "revoked" {
  if (key.revokedAt) return "revoked";
  return Date.parse(key.expiresAt) <= now ? "expired" : "active";
}
