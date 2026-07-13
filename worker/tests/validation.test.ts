import { describe, expect, test } from "vitest";
import {
  createProductSchema,
  createUnitSchema,
  updateContributionLogSchema,
  updateProductSchema,
  updateUnitSchema,
} from "../db/validation";

describe("Product validation schemas", () => {
  describe("createProductSchema", () => {
    test("accepts valid product", () => {
      const result = createProductSchema.safeParse({
        name: "招商安心宝",
        channel: "招商银行",
        category: "货币基金",
      });
      expect(result.success).toBe(true);
    });

    test("applies default currency CNY", () => {
      const result = createProductSchema.safeParse({
        name: "Test",
        channel: "招商银行",
        category: "货币基金",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe("CNY");
      }
    });

    test("rejects missing name", () => {
      const result = createProductSchema.safeParse({
        channel: "招商银行",
        category: "货币基金",
      });
      expect(result.success).toBe(false);
    });

    test("rejects invalid channel", () => {
      const result = createProductSchema.safeParse({
        name: "Test",
        channel: "无效渠道",
        category: "货币基金",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("channel must be one of");
      }
    });

    test("rejects invalid category", () => {
      const result = createProductSchema.safeParse({
        name: "Test",
        channel: "招商银行",
        category: "无效分类",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("category must be one of");
      }
    });

    test("rejects invalid currency", () => {
      const result = createProductSchema.safeParse({
        name: "Test",
        channel: "招商银行",
        category: "货币基金",
        currency: "JPY",
      });
      expect(result.success).toBe(false);
    });

    test("accepts all valid channels", () => {
      const channels = [
        "招商银行",
        "平安银行",
        "微众银行",
        "支付宝",
        "招银香港",
        "光大永明",
        "中信建投",
      ];
      for (const channel of channels) {
        const result = createProductSchema.safeParse({
          name: "Test",
          channel,
          category: "货币基金",
        });
        expect(result.success).toBe(true);
      }
    });

    test("accepts all valid categories", () => {
      const categories = [
        "养老年金",
        "储蓄保险",
        "混债基金",
        "债券基金",
        "货币基金",
        "股票基金",
        "指数基金",
        "宽基指数",
        "私募基金",
        "定期存款",
        "理财产品",
        "现金+",
      ];
      for (const category of categories) {
        const result = createProductSchema.safeParse({
          name: "Test",
          channel: "招商银行",
          category,
        });
        expect(result.success).toBe(true);
      }
    });

    test("accepts minimal product with only name", () => {
      // channel and category are optional (nullable)
      const result = createProductSchema.safeParse({
        name: "只有名称的产品",
      });
      expect(result.success).toBe(true);
    });

    test("accepts null for optional fields", () => {
      const result = createProductSchema.safeParse({
        name: "Test",
        code: null,
        channel: null,
        category: null,
        lockPeriodDays: null,
        annualReturnRate: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateProductSchema", () => {
    test("accepts partial update", () => {
      const result = updateProductSchema.safeParse({
        name: "新名称",
      });
      expect(result.success).toBe(true);
    });

    test("rejects empty update", () => {
      const result = updateProductSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("At least one field");
      }
    });

    test("validates channel if provided", () => {
      const result = updateProductSchema.safeParse({
        channel: "无效渠道",
      });
      expect(result.success).toBe(false);
    });

    test("accepts null to clear optional fields", () => {
      // code, channel, category, lockPeriodDays, annualReturnRate can all be cleared with null
      const result = updateProductSchema.safeParse({
        code: null,
        channel: null,
        category: null,
        lockPeriodDays: null,
        annualReturnRate: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBeNull();
        expect(result.data.channel).toBeNull();
        expect(result.data.category).toBeNull();
        expect(result.data.lockPeriodDays).toBeNull();
        expect(result.data.annualReturnRate).toBeNull();
      }
    });

    test("accepts mix of values and nulls", () => {
      const result = updateProductSchema.safeParse({
        name: "更新名称",
        code: null, // clear code
        channel: "招商银行", // set new channel
        category: null, // clear category
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("更新名称");
        expect(result.data.code).toBeNull();
        expect(result.data.channel).toBe("招商银行");
        expect(result.data.category).toBeNull();
      }
    });
  });
});

describe("Unit validation schemas", () => {
  describe("createUnitSchema", () => {
    test("accepts valid unit", () => {
      const result = createUnitSchema.safeParse({
        unitCode: "E01",
        amountCents: 5000000,
        strategy: "短期理财",
        tactics: "债券基金",
      });
      expect(result.success).toBe(true);
    });

    test("applies default status", () => {
      const result = createUnitSchema.safeParse({
        unitCode: "E01",
        amountCents: 5000000,
        strategy: "短期理财",
        tactics: "债券基金",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("已成立");
      }
    });

    test("rejects missing unitCode", () => {
      const result = createUnitSchema.safeParse({
        amountCents: 5000000,
        strategy: "短期理财",
        tactics: "债券基金",
      });
      expect(result.success).toBe(false);
    });

    test("rejects negative amountCents", () => {
      const result = createUnitSchema.safeParse({
        unitCode: "E01",
        amountCents: -100,
        strategy: "短期理财",
        tactics: "债券基金",
      });
      expect(result.success).toBe(false);
    });

    test("rejects invalid strategy", () => {
      const result = createUnitSchema.safeParse({
        unitCode: "E01",
        amountCents: 5000000,
        strategy: "无效策略",
        tactics: "债券基金",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("strategy must be one of");
      }
    });

    test("rejects invalid tactics", () => {
      const result = createUnitSchema.safeParse({
        unitCode: "E01",
        amountCents: 5000000,
        strategy: "短期理财",
        tactics: "无效战术",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("tactics must be one of");
      }
    });

    test("rejects invalid status", () => {
      const result = createUnitSchema.safeParse({
        unitCode: "E01",
        amountCents: 5000000,
        strategy: "短期理财",
        tactics: "债券基金",
        status: "无效状态",
      });
      expect(result.success).toBe(false);
    });

    test("accepts all valid strategies", () => {
      const strategies = [
        "远期理财",
        "美元资产",
        "36存单",
        "长期理财",
        "短期理财",
        "中期理财",
        "进攻计划",
        "麻麻理财",
      ];
      for (const strategy of strategies) {
        const result = createUnitSchema.safeParse({
          unitCode: "E01",
          amountCents: 5000000,
          strategy,
          tactics: "债券基金",
        });
        expect(result.success).toBe(true);
      }
    });

    test("accepts all valid tactics", () => {
      const tactics = [
        "养老年金",
        "个人养老金",
        "定期存款",
        "理财产品",
        "现金产品",
        "债券基金",
        "偏股基金",
        "稳健理财",
        "增额寿险",
        "货币基金",
      ];
      for (const t of tactics) {
        const result = createUnitSchema.safeParse({
          unitCode: "E01",
          amountCents: 5000000,
          strategy: "短期理财",
          tactics: t,
        });
        expect(result.success).toBe(true);
      }
    });

    test("accepts all valid statuses", () => {
      const statuses = ["已成立", "计划中", "筹集中", "已归档"];
      for (const status of statuses) {
        const result = createUnitSchema.safeParse({
          unitCode: "E01",
          amountCents: 5000000,
          strategy: "短期理财",
          tactics: "债券基金",
          status,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("updateUnitSchema", () => {
    test("accepts partial update", () => {
      const result = updateUnitSchema.safeParse({
        amountCents: 6000000,
      });
      expect(result.success).toBe(true);
    });

    test("rejects empty update", () => {
      const result = updateUnitSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    test("validates strategy if provided", () => {
      const result = updateUnitSchema.safeParse({
        strategy: "无效策略",
      });
      expect(result.success).toBe(false);
    });

    test("accepts null to clear optional fields", () => {
      // startDate, endDate, note can all be cleared with null
      // Note: productId must be updated alone per new constraint
      const result = updateUnitSchema.safeParse({
        startDate: null,
        endDate: null,
        note: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startDate).toBeNull();
        expect(result.data.endDate).toBeNull();
        expect(result.data.note).toBeNull();
      }
    });

    test("accepts productId alone to unlink product", () => {
      // productId must be updated alone (new constraint for auto-logging)
      const result = updateUnitSchema.safeParse({
        productId: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.productId).toBeNull();
      }
    });

    test("rejects productId with other fields", () => {
      // productId cannot be combined with other fields
      const result = updateUnitSchema.safeParse({
        amountCents: 7000000,
        productId: null,
        note: "新备注",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("productId must be updated alone");
      }
    });

    test("accepts mix of values and nulls without productId", () => {
      const result = updateUnitSchema.safeParse({
        amountCents: 7000000,
        note: "新备注",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amountCents).toBe(7000000);
        expect(result.data.note).toBe("新备注");
      }
    });
  });
});

describe("updateContributionLogSchema", () => {
  test("rejects empty object", () => {
    const result = updateContributionLogSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("At least one field must be provided");
    }
  });

  test("accepts a single field update", () => {
    const result = updateContributionLogSchema.safeParse({
      amountCents: 1234,
    });
    expect(result.success).toBe(true);
  });
});
