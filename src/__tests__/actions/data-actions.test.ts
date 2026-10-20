import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllData } from "@/app/actions/data-actions";
import { financeApi } from "@/lib/finance-api";
import { workerDbClient } from "@/lib/worker-db-client";

vi.mock("@/lib/finance-api", () => ({
  financeApi: {
    getFinancialPreferences: vi.fn(),
    listAccountClassifications: vi.fn(),
    listBalanceAnchors: vi.fn(),
    resetFinancialPreferences: vi.fn(),
    replaceAccountClassifications: vi.fn(),
    replaceBalanceAnchors: vi.fn(),
  },
}));
vi.mock("@/lib/worker-db-client", () => ({
  workerDbClient: {
    importData: vi.fn(),
    listProducts: vi.fn(),
    listUnits: vi.fn(),
    deleteUnit: vi.fn(),
    deleteProduct: vi.fn(),
    saveSettings: vi.fn(),
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(workerDbClient.listProducts).mockResolvedValue({
    products: [{ id: "p1", version: 2 }],
    total_returned: 1,
  });
  vi.mocked(workerDbClient.listUnits).mockResolvedValue({
    units: [{ id: "u1", version: 3 }],
    total_returned: 1,
  });
  vi.mocked(financeApi.getFinancialPreferences).mockResolvedValue({
    data: { version: 4 },
  } as never);
  vi.mocked(financeApi.listAccountClassifications).mockResolvedValue({
    data: [],
    meta: { dataRevision: 5 },
  } as never);
  vi.mocked(financeApi.listBalanceAnchors).mockResolvedValue({
    data: [],
    meta: { dataRevision: 6 },
  } as never);
});
describe("clear financial data", () => {
  it("resets typed finance only with explicit current snapshots, not site identity or keys", async () => {
    expect(await clearAllData()).toMatchObject({ success: true });
    expect(workerDbClient.importData).toHaveBeenCalledWith({ transactions: [], transfers: [] });
    expect(workerDbClient.deleteUnit).toHaveBeenCalledWith("u1", 3);
    expect(workerDbClient.deleteProduct).toHaveBeenCalledWith("p1", 2);
    expect(financeApi.replaceAccountClassifications).toHaveBeenCalledWith([], 5);
    expect(financeApi.replaceBalanceAnchors).toHaveBeenCalledWith([], 6);
    expect(financeApi.resetFinancialPreferences).toHaveBeenCalledWith(4);
    expect(workerDbClient.saveSettings).not.toHaveBeenCalled();
  });
  it("stops on conflict and never retries or reports partial cleanup as success", async () => {
    vi.mocked(financeApi.replaceAccountClassifications).mockRejectedValue(
      new Error("Changed; review"),
    );
    expect(await clearAllData()).toEqual({ success: false, error: "Changed; review" });
    expect(financeApi.replaceAccountClassifications).toHaveBeenCalledTimes(1);
    expect(financeApi.replaceBalanceAnchors).not.toHaveBeenCalled();
  });
});
