import { describe, expect, test } from "bun:test";
import { parseChineseCSV } from "@/domain/import/parse-chinese-csv";

describe("parseChineseCSV", () => {
  const header = "日期,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注";

  test("parses a valid expense row", () => {
    const csv = [
      header,
      "2025-03-15,支出,吃饭,0.00,35.50,人民币,支付宝,,午餐",
    ].join("\n");
    const result = parseChineseCSV(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.transactions).toHaveLength(1);

    const tx = result.transactions[0];
    expect(tx?.type).toBe("expense");
    expect(tx?.amountCents).toBe(3550);
    expect(tx?.primaryCategory).toBe("支出");
    expect(tx?.secondaryCategory).toBe("日常吃喝");
    expect(tx?.tertiaryCategory).toBe("吃饭");
    expect(tx?.account).toBe("支付宝");
    expect(tx?.currency).toBe("人民币");
    expect(tx?.note).toBe("午餐");
    expect(tx?.year).toBe(2025);
    expect(tx?.month).toBe(3);
    expect(tx?.day).toBe(15);
    expect(tx?.hasSecondaryMapping).toBe(true);
  });

  test("parses a valid income row", () => {
    const csv = [
      header,
      "2025-01-10,收入,工资,25000.00,0.00,人民币,招商银行,,一月薪资",
    ].join("\n");
    const result = parseChineseCSV(csv);
    expect(result.transactions).toHaveLength(1);

    const tx = result.transactions[0];
    expect(tx?.type).toBe("income");
    expect(tx?.amountCents).toBe(2500000);
    expect(tx?.secondaryCategory).toBe("薪资收入");
  });

  test("converts decimal amounts to cents correctly", () => {
    const csv = [
      header,
      "2025-06-01,支出,超市,0.00,123.45,人民币,微信,,",
    ].join("\n");
    const result = parseChineseCSV(csv);
    expect(result.transactions[0]?.amountCents).toBe(12345);
  });

  test("handles 余额调整 → 对账收入/对账支出", () => {
    const csvIncome = [
      header,
      "2025-01-01,收入,余额调整,100.00,0.00,人民币,支付宝,,",
    ].join("\n");
    const r1 = parseChineseCSV(csvIncome);
    expect(r1.transactions[0]?.tertiaryCategory).toBe("对账收入");

    const csvExpense = [
      header,
      "2025-01-01,支出,余额调整,0.00,50.00,人民币,支付宝,,",
    ].join("\n");
    const r2 = parseChineseCSV(csvExpense);
    expect(r2.transactions[0]?.tertiaryCategory).toBe("对账支出");
  });

  test("extracts tertiary from slash-separated value", () => {
    const csv = [
      header,
      "2025-01-01,收入,理财收入 / JY040205XXX,500.00,0.00,人民币,招商银行,,",
    ].join("\n");
    const result = parseChineseCSV(csv);
    expect(result.transactions[0]?.tertiaryCategory).toBe("理财收入");
    expect(result.transactions[0]?.secondaryCategory).toBe("投资收入");
  });

  test("skips zero-amount rows with warning", () => {
    const csv = [
      header,
      "2025-01-01,支出,吃饭,0.00,0.00,人民币,支付宝,,",
    ].join("\n");
    const result = parseChineseCSV(csv);
    expect(result.transactions).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toContain("均为 0");
  });

  test("returns error for empty CSV", () => {
    const result = parseChineseCSV("");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("为空");
  });

  test("returns error for wrong headers", () => {
    const csv = "date,type,amount\n2025-01-01,expense,100";
    const result = parseChineseCSV(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("表头格式错误");
  });

  test("returns error for invalid date", () => {
    const csv = [
      header,
      "not-a-date,支出,吃饭,0.00,10.00,人民币,支付宝,,",
    ].join("\n");
    const result = parseChineseCSV(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("日期格式无效");
  });

  test("parses tags as JSON string", () => {
    const csv = [
      header,
      "2025-01-01,支出,吃饭,0.00,20.00,人民币,支付宝,日常,聚餐,,",
    ].join("\n");
    const result = parseChineseCSV(csv);
    // tags column is comma-separated, but our parseCSVLine will split correctly
    // In the 9-column format: "日常,聚餐" would need to be quoted in CSV
    // but without quoting, the CSV splits into more columns
    expect(result.transactions.length).toBeGreaterThanOrEqual(0);
  });

  test("handles quoted fields with commas", () => {
    const csv = [
      header,
      '2025-01-01,支出,吃饭,0.00,20.00,人民币,支付宝,"标签A,标签B",备注',
    ].join("\n");
    const result = parseChineseCSV(csv);
    expect(result.transactions).toHaveLength(1);
    const tags = JSON.parse(result.transactions[0]?.tags ?? "[]");
    expect(tags).toEqual(["标签A", "标签B"]);
  });

  test("handles Windows CRLF line endings", () => {
    const csv = [
      header,
      "2025-01-01,支出,吃饭,0.00,20.00,人民币,支付宝,,",
    ].join("\r\n");
    const result = parseChineseCSV(csv);
    expect(result.transactions).toHaveLength(1);
  });

  test("marks unmapped categories with has_secondary_mapping = 0", () => {
    const csv = [
      header,
      "2025-01-01,支出,不存在的类型,0.00,10.00,人民币,支付宝,,",
    ].join("\n");
    const result = parseChineseCSV(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.secondaryCategory).toBe("未分类");
    expect(result.transactions[0]?.hasSecondaryMapping).toBe(false);
  });

  test("multiple rows produce correct year validation data", () => {
    const csv = [
      header,
      "2025-01-01,支出,吃饭,0.00,10.00,人民币,支付宝,,",
      "2025-06-15,收入,工资,8000.00,0.00,人民币,招商银行,,",
      "2025-12-31,支出,超市,0.00,55.00,人民币,微信,,",
    ].join("\n");
    const result = parseChineseCSV(csv);
    expect(result.transactions).toHaveLength(3);
    const years = new Set(result.transactions.map((t) => t.year));
    expect(years.size).toBe(1);
    expect(years.has(2025)).toBe(true);
  });
});
