import { beforeEach, describe, expect, it, vi } from "vitest";
import { accountDetailLoader } from "@/app/account-detail/page";
import { expenseLoader } from "@/app/expense/page";
import { financialHealthLoader } from "@/app/financial-health/page";
import { freedomLoader } from "@/app/freedom/page";
import { incomeLoader } from "@/app/income/page";
import { overviewLoader } from "@/app/page";
import { financeApi } from "@/lib/finance-api";
import { workerDbClient } from "@/lib/worker-db-client";

vi.mock("@/lib/finance-api", () => ({
  financeApi: { getFinancialPreferences: vi.fn(), listBalanceAnchors: vi.fn() },
}));
vi.mock("@/lib/worker-db-client", () => ({
  workerDbClient: {
    getMetadata: vi.fn(),
    getYearlySummary: vi.fn(),
    searchTransactions: vi.fn(),
    getAllTransactionsByYear: vi.fn(),
    getAllTransfersByYear: vi.fn(),
  },
}));
const request = new Request("https://example.test/?year=2026");
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(workerDbClient.getMetadata).mockResolvedValue({ years: [2026] } as never);
  vi.mocked(workerDbClient.getYearlySummary).mockResolvedValue({
    months: [],
    totals: { income: 100, expense: 50, count: 2 },
  });
  const rows = ["CNY", "USD"].map((currency) => ({
    id: currency,
    account: "A",
    currency,
    amountCents: 100,
    type: "income",
    date: "2026-01-02",
    year: 2026,
    month: 1,
  }));
  vi.mocked(workerDbClient.searchTransactions).mockResolvedValue({
    transactions: rows,
    total_returned: 2,
  });
  vi.mocked(workerDbClient.getAllTransactionsByYear).mockResolvedValue({
    transactions: rows,
    total_returned: 2,
  });
  vi.mocked(workerDbClient.getAllTransfersByYear).mockResolvedValue({
    transfers: [],
    total_returned: 0,
  });
  vi.mocked(financeApi.getFinancialPreferences).mockResolvedValue({
    data: {
      savingsRateTarget: 30,
      activeIncomeCategories: ["Salary"],
      fixedExpenseCategories: ["Rent"],
    },
    meta: {},
  } as never);
  vi.mocked(financeApi.listBalanceAnchors).mockResolvedValue({
    data: ["CNY", "USD"].map((currency) => ({
      accountName: "A",
      date: "2026-01-01",
      balanceCents: currency === "CNY" ? 1000 : 9900,
      currency,
    })),
    meta: {},
  } as never);
});
describe("single-currency financial views", () => {
  it("requests explicit CNY summaries and recent rows, filtering mixed raw rows defensively", async () => {
    const overview = await overviewLoader({ request });
    expect(workerDbClient.getYearlySummary).toHaveBeenCalledWith(2026, "CNY");
    expect(workerDbClient.searchTransactions).toHaveBeenCalledWith({
      year: 2026,
      limit: 10,
      currency: "CNY",
    });
    expect(overview.transactions.map((row) => row.currency)).toEqual(["CNY"]);
    for (const loader of [incomeLoader, expenseLoader, freedomLoader]) {
      const data = await loader({ request });
      expect(data.transactions.map((row) => row.currency)).toEqual(["CNY"]);
    }
    expect(await freedomLoader({ request })).toMatchObject({ activeIncomeCategories: ["Salary"] });
    await financialHealthLoader({ request });
    expect(financeApi.getFinancialPreferences).toHaveBeenCalledTimes(4);
  });
  it("uses only same-currency transactions/transfers/anchors for account balances", async () => {
    const data = await accountDetailLoader({ request });
    expect(data.summary).toMatchObject({ initialBalance: 10, finalBalance: 11, hasAnchor: true });
    expect(data.displayEntries.filter((row) => row.type === "income")).toHaveLength(1);
  });
});
