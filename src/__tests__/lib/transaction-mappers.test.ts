import { describe, it, expect } from "bun:test"
import { parseTags, toDomainTransaction } from "@/lib/transaction-mappers"

describe("parseTags", () => {
  it("parses JSON string to array", () => {
    expect(parseTags('["餐饮","工作餐"]')).toEqual(["餐饮", "工作餐"])
  })

  it("handles empty JSON array string", () => {
    expect(parseTags("[]")).toEqual([])
  })

  it("handles array input directly", () => {
    expect(parseTags(["tag1", "tag2"])).toEqual(["tag1", "tag2"])
  })

  it("handles empty array", () => {
    expect(parseTags([])).toEqual([])
  })

  it("handles null", () => {
    expect(parseTags(null)).toEqual([])
  })

  it("handles undefined", () => {
    expect(parseTags(undefined)).toEqual([])
  })

  it("handles empty string", () => {
    expect(parseTags("")).toEqual([])
  })

  it("handles malformed JSON gracefully", () => {
    expect(parseTags("not-json")).toEqual([])
  })

  it("handles JSON object (not array) gracefully", () => {
    expect(parseTags('{"key":"value"}')).toEqual([])
  })

  it("filters non-string values from array", () => {
    expect(parseTags([1, "valid", null, "also-valid"])).toEqual([
      "valid",
      "also-valid",
    ])
  })

  it("filters non-string values from parsed JSON", () => {
    expect(parseTags('[1, "valid", null, "also-valid"]')).toEqual([
      "valid",
      "also-valid",
    ])
  })
})

describe("toDomainTransaction", () => {
  it("parses tags from JSON string", () => {
    const raw = {
      id: "tx-1",
      date: "2026-01-15",
      year: 2026,
      month: 1,
      primaryCategory: "餐饮",
      secondaryCategory: "午餐",
      tertiaryCategory: "",
      amountCents: 5000,
      account: "支付宝",
      type: "expense",
      currency: "CNY",
      tags: '["工作餐","报销"]',
      note: "团队午餐",
    }

    const result = toDomainTransaction(raw)

    expect(result.tags).toEqual(["工作餐", "报销"])
  })

  it("parses tags from array (backward compatibility)", () => {
    const raw = {
      id: "tx-1",
      date: "2026-01-15",
      year: 2026,
      month: 1,
      primaryCategory: "餐饮",
      amountCents: 5000,
      account: "支付宝",
      type: "expense",
      tags: ["existing", "array"],
    }

    const result = toDomainTransaction(raw)

    expect(result.tags).toEqual(["existing", "array"])
  })

  it("handles missing tags", () => {
    const raw = {
      id: "tx-1",
      date: "2026-01-15",
      year: 2026,
      month: 1,
      primaryCategory: "餐饮",
      amountCents: 5000,
      account: "支付宝",
      type: "expense",
    }

    const result = toDomainTransaction(raw)

    expect(result.tags).toEqual([])
  })

  it("converts amountCents to yuan", () => {
    const raw = {
      id: "tx-1",
      date: "2026-01-15",
      year: 2026,
      month: 1,
      primaryCategory: "餐饮",
      amountCents: 12345,
      account: "支付宝",
      type: "expense",
    }

    const result = toDomainTransaction(raw)

    expect(result.amount).toBe(123.45)
  })
})
