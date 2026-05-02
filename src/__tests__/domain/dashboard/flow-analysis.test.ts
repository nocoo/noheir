import { describe, expect, it } from "vitest";
import {
  buildFlowTabs,
  buildFlowTitle,
  buildFlowTransactions,
} from "@/domain/dashboard/flow-analysis";
import type { DomainTransaction } from "@/domain/types";

describe("flow-analysis domain", () => {
  it("builds tabs and title", () => {
    const tabs = buildFlowTabs();
    const title = buildFlowTitle();
    expect(tabs.length).toBe(2);
    expect(title.title).toBe("流向分析");
  });

  it("passes through transactions", () => {
    const tx: DomainTransaction[] = [
      {
        id: "1",
        date: "2024-01-01",
        year: 2024,
        month: 1,
        primaryCategory: "収入",
        secondaryCategory: "工资",
        tertiaryCategory: "月薪",
        amount: 100,
        account: "A",
        type: "income",
        currency: "CNY",
        tags: [],
        note: null,
      },
    ];
    const result = buildFlowTransactions(tx);
    expect(result.length).toBe(1);
  });
});
