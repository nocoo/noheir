import { beforeEach, describe, expect, it, vi } from "vitest";
import { accountTypesLoader } from "@/app/account-types/page";
import {
  saveAccountTypes,
  saveActiveIncomeCategories,
  saveBalanceAnchors,
  saveFinancialPreferences,
  saveFixedExpenseCategories,
} from "@/app/actions/settings-actions";
import { balanceAnchorsLoader } from "@/app/balance-anchors/page";
import { categorySettingsLoader } from "@/app/category-settings/page";
import { settingsLoader } from "@/app/settings/page";
import { financeApi } from "@/lib/finance-api";
import { workerDbClient } from "@/lib/worker-db-client";

vi.mock("@/lib/finance-api", () => ({
  financeApi: {
    listAccountClassifications: vi.fn(),
    listBalanceAnchors: vi.fn(),
    getFinancialPreferences: vi.fn(),
    replaceAccountClassifications: vi.fn(),
    replaceBalanceAnchors: vi.fn(),
    saveFinancialPreferences: vi.fn(),
  },
}));
vi.mock("@/lib/worker-db-client", () => ({
  workerDbClient: { getMetadata: vi.fn(), getCategorySummary: vi.fn() },
}));
beforeEach(() => vi.resetAllMocks());
describe("typed financial settings", () => {
  it("selects leaf categories used by deterministic financial calculations", async () => {
    vi.mocked(workerDbClient.getMetadata).mockResolvedValue({ years: [2026] } as never);
    vi.mocked(workerDbClient.getCategorySummary).mockResolvedValue({
      categories: [
        {
          primary_category: "Income",
          secondary_category: "Work",
          tertiary_category: "Salary",
          total: 100,
          count: 1,
        },
      ],
    });
    vi.mocked(financeApi.getFinancialPreferences).mockResolvedValue({
      data: { activeIncomeCategories: ["Salary"], fixedExpenseCategories: [], version: 1 },
    } as never);
    expect(await categorySettingsLoader()).toMatchObject({
      incomeCategories: ["Salary"],
      expenseCategories: ["Salary"],
      version: 1,
    });
  });
  it("loads typed data and collection preconditions without raw settings", async () => {
    vi.mocked(workerDbClient.getMetadata).mockResolvedValue({ accounts: ["Z", "A"] } as never);
    vi.mocked(financeApi.listAccountClassifications).mockResolvedValue({
      data: [{ accountName: "A", type: "debit" }],
      meta: { dataRevision: 7 },
    } as never);
    vi.mocked(financeApi.listBalanceAnchors).mockResolvedValue({
      data: [{ accountName: "A", date: "2026-01-01", balanceCents: 123, currency: "USD" }],
      meta: { dataRevision: 8 },
    } as never);
    vi.mocked(financeApi.getFinancialPreferences).mockResolvedValue({
      data: { savingsRateTarget: 0, version: 2 },
    } as never);
    expect(await accountTypesLoader()).toMatchObject({
      accountTypes: [{ accountName: "A", type: "debit" }],
      revision: 7,
    });
    expect(await balanceAnchorsLoader()).toEqual({
      accounts: ["A", "Z"],
      anchors: [{ accountName: "A", date: "2026-01-01", balance: 1.23, currency: "USD" }],
      revision: 8,
    });
    expect(await settingsLoader()).toEqual({ preferences: { savingsRateTarget: 0, version: 2 } });
  });
  it("performs one atomic whole-array save with the loaded revision, preserving integer cents", async () => {
    expect(await saveAccountTypes([{ accountName: "Cash", type: "debit" }], 7)).toEqual({
      success: true,
      data: undefined,
    });
    expect(financeApi.replaceAccountClassifications).toHaveBeenCalledWith(
      [{ accountName: "Cash", type: "debit" }],
      7,
    );
    expect(
      await saveBalanceAnchors(
        [{ accountName: "Cash", date: "2026-01-01", balance: -1.23, currency: "USD" }],
        8,
      ),
    ).toEqual({ success: true, data: undefined });
    expect(financeApi.replaceBalanceAnchors).toHaveBeenCalledWith(
      [{ accountName: "Cash", date: "2026-01-01", balanceCents: -123, currency: "USD" }],
      8,
    );
  });
  it("patches independent preferences once and never reads or overwrites unrelated values", async () => {
    expect(
      await saveFinancialPreferences(
        { savingsRateTarget: 0, minReturnRate: 2, maxReturnRate: 6 },
        3,
      ),
    ).toMatchObject({ success: true });
    await saveActiveIncomeCategories(["Salary"], 4);
    await saveFixedExpenseCategories(["Rent"], 5);
    expect(financeApi.saveFinancialPreferences).toHaveBeenNthCalledWith(
      1,
      { savingsRateTarget: 0, minReturnRate: 2, maxReturnRate: 6 },
      3,
    );
    expect(financeApi.saveFinancialPreferences).toHaveBeenNthCalledWith(
      2,
      { activeIncomeCategories: ["Salary"] },
      4,
    );
    expect(financeApi.saveFinancialPreferences).toHaveBeenNthCalledWith(
      3,
      { fixedExpenseCategories: ["Rent"] },
      5,
    );
    expect(financeApi.getFinancialPreferences).not.toHaveBeenCalled();
  });
  it("keeps stale/network/validation failures visible and never retries destructive saves", async () => {
    vi.mocked(financeApi.replaceAccountClassifications).mockRejectedValue(
      new Error("Changed; reload first"),
    );
    expect(await saveAccountTypes([], 1)).toEqual({
      success: false,
      error: "Changed; reload first",
    });
    vi.mocked(financeApi.replaceBalanceAnchors).mockRejectedValue("offline");
    expect(await saveBalanceAnchors([], 1)).toEqual({
      success: false,
      error: "Failed to save financial data",
    });
    expect(
      await saveBalanceAnchors([{ accountName: "Cash", date: "invalid", balance: Number.NaN }], 1),
    ).toMatchObject({ success: false });
    vi.mocked(financeApi.saveFinancialPreferences).mockRejectedValue(new Error("Stale version"));
    expect(await saveFinancialPreferences({ savingsRateTarget: 40 }, 1)).toEqual({
      success: false,
      error: "Stale version",
    });
    expect(financeApi.replaceAccountClassifications).toHaveBeenCalledTimes(1);
  });
});
