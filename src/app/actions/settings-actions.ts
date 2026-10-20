import {
  accountClassificationSchema,
  balanceAnchorSchema,
  type FinancialPreferencesInput,
} from "@/domain/api-contract";
import type { AccountTypeConfig, BalanceAnchor } from "@/domain/types";
import type { ActionResult } from "@/lib/action-result";
import { financeApi } from "@/lib/finance-api";

async function save(operation: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await operation();
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save financial data",
    };
  }
}

export function saveFinancialPreferences(
  data: Partial<FinancialPreferencesInput>,
  version: number,
): Promise<ActionResult> {
  return save(() => financeApi.saveFinancialPreferences(data, version));
}
export function saveActiveIncomeCategories(
  categories: string[],
  version: number,
): Promise<ActionResult> {
  return saveFinancialPreferences({ activeIncomeCategories: categories }, version);
}
export function saveFixedExpenseCategories(
  categories: string[],
  version: number,
): Promise<ActionResult> {
  return saveFinancialPreferences({ fixedExpenseCategories: categories }, version);
}
export function saveBalanceAnchors(
  anchors: BalanceAnchor[],
  revision: number,
): Promise<ActionResult> {
  return save(() =>
    financeApi.replaceBalanceAnchors(
      anchors.map((anchor) =>
        balanceAnchorSchema.parse({
          accountName: anchor.accountName,
          date: anchor.date,
          currency: anchor.currency ?? "CNY",
          balanceCents: Math.round(anchor.balance * 100),
        }),
      ),
      revision,
    ),
  );
}
export function saveAccountTypes(
  types: AccountTypeConfig[],
  revision: number,
): Promise<ActionResult> {
  return save(() =>
    financeApi.replaceAccountClassifications(
      types.map((item) => accountClassificationSchema.parse(item)),
      revision,
    ),
  );
}
