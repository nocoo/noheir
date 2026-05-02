import { describe, expect, test } from "vitest";
import { parseChineseTransferCSV } from "@/domain/import/parse-chinese-transfer-csv";

describe("parseChineseTransferCSV", () => {
  const header =
    "日期,收支大类,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注";

  test("parses a valid transfer row", () => {
    const csv = [
      header,
      "2025-03-15,转账,转账,转账 / 转出,0.00,5000.00,人民币,招商银行 → 支付宝,,",
    ].join("\n");
    const result = parseChineseTransferCSV(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.transfers).toHaveLength(1);

    const tr = result.transfers[0];
    expect(tr?.year).toBe(2025);
    expect(tr?.month).toBe(3);
    expect(tr?.day).toBe(15);
    expect(tr?.outflowAmountCents).toBe(500000);
    expect(tr?.inflowAmountCents).toBe(0);
    expect(tr?.account).toBe("招商银行 → 支付宝");
    expect(tr?.secondaryCategory).toBe("转账");
    expect(tr?.transactionType).toBe("转账 / 转出");
  });

  test("filters out 转账 / 优惠抵扣 rows", () => {
    const csv = [
      header,
      "2025-01-01,转账,转账,转账 / 优惠抵扣,10.00,0.00,人民币,支付宝,,优惠券",
      "2025-01-01,转账,转账,转账 / 转出,0.00,100.00,人民币,招商银行 → 微信,,",
    ].join("\n");
    const result = parseChineseTransferCSV(csv);
    expect(result.transfers).toHaveLength(1);
    expect(result.filteredCount).toBe(1);
  });

  test("returns error for empty CSV", () => {
    const result = parseChineseTransferCSV("");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("为空");
  });

  test("returns error for wrong headers (transaction CSV)", () => {
    // Transaction CSV headers (missing 收支大类)
    const csv =
      "日期,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注\n2025-01-01,支出,吃饭,0,10,人民币,支付宝,,";
    const result = parseChineseTransferCSV(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("收支大类");
  });

  test("returns error for invalid date format", () => {
    const csv = [
      header,
      "invalid-date,转账,转账,转账 / 转出,0.00,100.00,人民币,招商银行,,",
    ].join("\n");
    const result = parseChineseTransferCSV(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("日期格式无效");
  });

  test("converts decimal amounts to cents", () => {
    const csv = [
      header,
      "2025-06-01,转账,转账,转账 / 转入,1234.56,0.00,人民币,微信,,",
    ].join("\n");
    const result = parseChineseTransferCSV(csv);
    expect(result.transfers[0]?.inflowAmountCents).toBe(123456);
    expect(result.transfers[0]?.outflowAmountCents).toBe(0);
  });

  test("handles Windows CRLF line endings", () => {
    const csv = [
      header,
      "2025-01-01,转账,转账,转账 / 转出,0.00,500.00,人民币,银行 → 支付宝,,",
    ].join("\r\n");
    const result = parseChineseTransferCSV(csv);
    expect(result.transfers).toHaveLength(1);
  });

  test("parses tags as JSON string", () => {
    const csv = [
      header,
      '2025-01-01,转账,转账,转账 / 转出,0.00,500.00,人民币,银行 → 支付宝,"标签1,标签2",',
    ].join("\n");
    const result = parseChineseTransferCSV(csv);
    expect(result.transfers).toHaveLength(1);
    const tags = JSON.parse(result.transfers[0]?.tags ?? "[]");
    expect(tags).toEqual(["标签1", "标签2"]);
  });

  test("multiple rows from same year", () => {
    const csv = [
      header,
      "2025-01-10,转账,转账,转账 / 转出,0.00,1000.00,人民币,银行A → 银行B,,",
      "2025-03-22,转账,转账,转账 / 转入,2000.00,0.00,人民币,银行B,,",
      "2025-06-30,转账,转账,转账 / 转出,0.00,500.00,人民币,微信 → 支付宝,,",
    ].join("\n");
    const result = parseChineseTransferCSV(csv);
    expect(result.transfers).toHaveLength(3);
    const years = new Set(result.transfers.map((t) => t.year));
    expect(years.size).toBe(1);
  });
});
