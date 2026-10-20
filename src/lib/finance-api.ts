import { environmentFetch } from "@/components/environment-runtime";
import type {
  AccountClassification,
  AccountClassificationInput,
  Analysis,
  AnalysisInput,
  ApiEnvelope,
  ApiKeyCreate,
  ApiKeyInfo,
  ApiMutation,
  BalanceAnchorInput,
  BalanceAnchorResource,
  FinancialPreferences,
  FinancialPreferencesInput,
} from "@/domain/api-contract";

export class FinanceApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "FinanceApiError";
  }
}

export class FinanceApiClient {
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    version?: number,
  ): Promise<ApiEnvelope<T>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (version !== undefined) {
      if (!Number.isSafeInteger(version) || version < 0) throw new Error("Invalid version");
      headers["If-Match"] = `"${version}"`;
    }
    const init: RequestInit = { method, headers, cache: "no-store" };
    if (body !== undefined) init.body = JSON.stringify(body);
    const response = await environmentFetch(path, init);
    if (!response.ok) {
      const problem = (await response.json().catch(() => ({}))) as {
        title?: string;
        error?: string;
        code?: string;
        requestId?: string;
      };
      throw new FinanceApiError(
        response.status,
        response.status === 412
          ? "数据版本已变化，请刷新并核对后重新编辑；未自动重试。"
          : (problem.title ?? problem.error ?? `Request failed (${response.status})`),
        problem.code,
        problem.requestId,
      );
    }
    if (response.status === 204) return undefined as unknown as ApiEnvelope<T>;
    return response.json() as Promise<ApiEnvelope<T>>;
  }

  private async collection<T>(path: string): Promise<ApiEnvelope<T[]>> {
    const first = await this.request<T[]>("GET", path);
    const data = [...first.data];
    const seen = new Set<string>();
    let page = first;
    while (page.meta.hasMore) {
      const cursor = page.meta.nextCursor;
      if (!cursor || seen.has(cursor)) throw new Error("Incomplete collection response");
      seen.add(cursor);
      page = await this.request<T[]>("GET", `${path}?${new URLSearchParams({ cursor })}`);
      if (page.meta.dataRevision !== first.meta.dataRevision)
        throw new Error("Financial data changed; reload before saving");
      data.push(...page.data);
    }
    return {
      data,
      meta: { ...first.meta, returned: data.length, hasMore: false, nextCursor: null },
    };
  }

  listKeys() {
    return this.request<ApiKeyInfo[]>("GET", "/api/api-keys");
  }
  createKey(input: ApiKeyCreate) {
    return this.request<ApiKeyInfo & { token: string }>("POST", "/api/api-keys", input);
  }
  revokeKey(id: string) {
    return this.request<ApiMutation>("DELETE", `/api/api-keys/${encodeURIComponent(id)}`);
  }
  listAnalyses(filters = new URLSearchParams()) {
    const query = filters.toString();
    return this.request<Analysis[]>("GET", `/api/analyses${query ? `?${query}` : ""}`);
  }
  getAnalysis(id: string) {
    return this.request<Analysis>("GET", `/api/analyses/${encodeURIComponent(id)}`);
  }
  createAnalysis(input: AnalysisInput) {
    return this.request<ApiMutation>("POST", "/api/analyses", input);
  }
  updateAnalysis(id: string, version: number, input: Partial<AnalysisInput>) {
    return this.request<ApiMutation>(
      "PATCH",
      `/api/analyses/${encodeURIComponent(id)}`,
      input,
      version,
    );
  }
  deleteAnalysis(id: string, version: number) {
    return this.request<ApiMutation>(
      "DELETE",
      `/api/analyses/${encodeURIComponent(id)}`,
      undefined,
      version,
    );
  }
  listAccountClassifications() {
    return this.collection<AccountClassification>("/api/account-classifications");
  }
  replaceAccountClassifications(items: AccountClassificationInput[], revision: number) {
    return this.request<ApiMutation>("PUT", "/api/account-classifications", { items }, revision);
  }
  listBalanceAnchors() {
    return this.collection<BalanceAnchorResource>("/api/balance-anchors");
  }
  replaceBalanceAnchors(items: BalanceAnchorInput[], revision: number) {
    return this.request<ApiMutation>("PUT", "/api/balance-anchors", { items }, revision);
  }
  getFinancialPreferences() {
    return this.request<FinancialPreferences>("GET", "/api/financial-preferences");
  }
  saveFinancialPreferences(input: Partial<FinancialPreferencesInput>, version: number) {
    return this.request<ApiMutation>("PATCH", "/api/financial-preferences", input, version);
  }
  resetFinancialPreferences(version: number) {
    return this.request<ApiMutation>("DELETE", "/api/financial-preferences", undefined, version);
  }
}
export const financeApi = new FinanceApiClient();
