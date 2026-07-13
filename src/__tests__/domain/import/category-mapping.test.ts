import { describe, expect, test } from "vitest";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  findSecondaryCategory,
} from "@/domain/import/category-mapping";

describe("DEFAULT_EXPENSE_CATEGORIES", () => {
  test("has 12 secondary expense categories", () => {
    expect(Object.keys(DEFAULT_EXPENSE_CATEGORIES)).toHaveLength(12);
  });

  test("日常吃喝 contains expected tertiary categories", () => {
    expect(DEFAULT_EXPENSE_CATEGORIES.日常吃喝).toContain("吃饭");
    expect(DEFAULT_EXPENSE_CATEGORIES.日常吃喝).toContain("外卖");
    expect(DEFAULT_EXPENSE_CATEGORIES.日常吃喝).toContain("超市");
  });
});

describe("DEFAULT_INCOME_CATEGORIES", () => {
  test("has 4 secondary income categories", () => {
    expect(Object.keys(DEFAULT_INCOME_CATEGORIES)).toHaveLength(4);
  });

  test("薪资收入 contains 工资", () => {
    expect(DEFAULT_INCOME_CATEGORIES.薪资收入).toContain("工资");
  });
});

describe("findSecondaryCategory", () => {
  test("finds secondary for known expense tertiary", () => {
    expect(findSecondaryCategory("支出", "吃饭", "expense")).toBe("日常吃喝");
    expect(findSecondaryCategory("支出", "外卖", "expense")).toBe("日常吃喝");
    expect(findSecondaryCategory("支出", "手续费", "expense")).toBe("系统支出");
  });

  test("finds secondary for known income tertiary", () => {
    expect(findSecondaryCategory("收入", "工资", "income")).toBe("薪资收入");
    expect(findSecondaryCategory("收入", "理财收入", "income")).toBe("投资收入");
    expect(findSecondaryCategory("收入", "红包", "income")).toBe("资助收入");
  });

  test("returns null for unknown tertiary", () => {
    expect(findSecondaryCategory("支出", "不存在的分类", "expense")).toBeNull();
  });

  test("returns secondary name when tertiary is actually a secondary name", () => {
    // "日常吃喝" is a secondary name, not a tertiary — should return itself
    expect(findSecondaryCategory("支出", "日常吃喝", "expense")).toBe("日常吃喝");
    expect(findSecondaryCategory("收入", "薪资收入", "income")).toBe("薪资收入");
  });

  test("primaryCategory is ignored (all lookups are by type)", () => {
    // primaryCategory param exists for API compat but doesn't affect lookup
    expect(findSecondaryCategory("任意", "吃饭", "expense")).toBe("日常吃喝");
  });
});
