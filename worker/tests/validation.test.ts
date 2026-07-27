import { describe, expect, test } from "vitest";
import {
  commitUnitSchema,
  createContributionLogSchema,
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

    // Cyclic-lock pairing: openDays and cycleDays must travel together.
    test("rejects openDays without cycleDays and vice versa", () => {
      expect(updateProductSchema.safeParse({ openDays: 7 }).success).toBe(false);
      expect(updateProductSchema.safeParse({ cycleDays: 30 }).success).toBe(false);
    });

    test("rejects mixing null with a value", () => {
      expect(updateProductSchema.safeParse({ openDays: null, cycleDays: 30 }).success).toBe(false);
      expect(updateProductSchema.safeParse({ openDays: 7, cycleDays: null }).success).toBe(false);
    });

    test("accepts both null or both set with cycle > open", () => {
      expect(updateProductSchema.safeParse({ openDays: null, cycleDays: null }).success).toBe(true);
      expect(updateProductSchema.safeParse({ openDays: 7, cycleDays: 30 }).success).toBe(true);
    });

    test("rejects cycleDays <= openDays", () => {
      expect(updateProductSchema.safeParse({ openDays: 30, cycleDays: 30 }).success).toBe(false);
      expect(updateProductSchema.safeParse({ openDays: 30, cycleDays: 7 }).success).toBe(false);
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

  test("accepts pnlCents including negative and null", () => {
    expect(updateContributionLogSchema.safeParse({ pnlCents: 500 }).success).toBe(true);
    expect(updateContributionLogSchema.safeParse({ pnlCents: -500 }).success).toBe(true);
    expect(updateContributionLogSchema.safeParse({ pnlCents: null }).success).toBe(true);
  });

  test("rejects non-integer pnlCents", () => {
    expect(updateContributionLogSchema.safeParse({ pnlCents: 1.5 }).success).toBe(false);
  });
});

describe("createContributionLogSchema", () => {
  const base = {
    unitId: "123e4567-e89b-12d3-a456-426614174000",
    operationType: "invest" as const,
    amountCents: 100000,
    operationDate: "2026-07-27",
  };

  test("accepts valid log without pnlCents", () => {
    const result = createContributionLogSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.source).toBe("manual");
  });

  test("accepts pnlCents including negative and null", () => {
    expect(createContributionLogSchema.safeParse({ ...base, pnlCents: 500 }).success).toBe(true);
    expect(createContributionLogSchema.safeParse({ ...base, pnlCents: -500 }).success).toBe(true);
    expect(createContributionLogSchema.safeParse({ ...base, pnlCents: null }).success).toBe(true);
  });

  test("rejects non-integer pnlCents", () => {
    expect(createContributionLogSchema.safeParse({ ...base, pnlCents: 1.5 }).success).toBe(false);
  });

  test("rejects malformed operationDate", () => {
    const result = createContributionLogSchema.safeParse({ ...base, operationDate: "2026-7-2" });
    expect(result.success).toBe(false);
  });
});

describe("commitUnitSchema", () => {
  const expected = {
    unitCode: "CU01-001",
    amountCents: 1000000,
    productId: "123e4567-e89b-12d3-a456-426614174000",
    currency: "CNY",
    status: "已成立",
    strategy: "长期理财",
    tactics: "债券基金",
    startDate: "2026-01-01",
    endDate: null,
    note: null,
  };
  const PROD_B = "223e4567-e89b-12d3-a456-426614174000";
  const UNIT_B = "323e4567-e89b-12d3-a456-426614174000";

  test("accepts metadata-only commit", () => {
    const r = commitUnitSchema.safeParse({ expected, metadata: { amountCents: 2000000 } });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.operations).toEqual([]);
  });

  test("accepts note-only commit", () => {
    expect(commitUnitSchema.safeParse({ expected, commitNote: "记一笔" }).success).toBe(true);
  });

  test("rejects a commit with nothing in it", () => {
    const r = commitUnitSchema.safeParse({ expected });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes("must contain metadata"))).toBe(true);
    }
  });

  test("rejects a blank-only note", () => {
    expect(commitUnitSchema.safeParse({ expected, commitNote: "   " }).success).toBe(false);
  });

  test("rejects empty metadata object", () => {
    const r = commitUnitSchema.safeParse({ expected, metadata: {} });
    expect(r.success).toBe(false);
  });

  test("metadata cannot carry productId or endDate", () => {
    const r = commitUnitSchema.safeParse({ expected, metadata: { productId: PROD_B } });
    expect(r.success).toBe(false); // stripped → metadata becomes empty
  });

  test("expected mirrors DB nullability", () => {
    const allNull = {
      ...expected,
      productId: null,
      currency: null,
      status: null,
      strategy: null,
      tactics: null,
      startDate: null,
    };
    expect(commitUnitSchema.safeParse({ expected: allNull, commitNote: "x" }).success).toBe(true);
  });

  test("rejects duplicate operation kinds", () => {
    const r = commitUnitSchema.safeParse({
      expected,
      operations: [
        { kind: "switch_product", toProductId: PROD_B },
        { kind: "switch_product", toProductId: null },
      ],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes("at most one operation"))).toBe(true);
    }
  });

  test("rejects editing unitCode while a swap is staged", () => {
    const r = commitUnitSchema.safeParse({
      expected,
      metadata: { unitCode: "CU01-999" },
      operations: [{ kind: "swap_unit_code", targetUnitId: UNIT_B }],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes("unitCode cannot be edited"))).toBe(
        true,
      );
    }
  });

  test("rejects editing amount while a switch is staged", () => {
    const r = commitUnitSchema.safeParse({
      expected,
      metadata: { amountCents: 5 },
      operations: [{ kind: "switch_product", toProductId: PROD_B }],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes("amount cannot be edited"))).toBe(true);
    }
  });

  test("allows swap + switch together", () => {
    const r = commitUnitSchema.safeParse({
      expected,
      operations: [
        { kind: "swap_unit_code", targetUnitId: UNIT_B },
        { kind: "switch_product", toProductId: PROD_B, pnlCents: -500 },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("rejects malformed operationDate", () => {
    const r = commitUnitSchema.safeParse({
      expected,
      commitNote: "x",
      operationDate: "2026-7-2",
    });
    expect(r.success).toBe(false);
  });
});

describe("contribution source enum (docs/003 Decision K)", () => {
  const base = {
    unitId: "123e4567-e89b-12d3-a456-426614174000",
    operationType: "invest" as const,
    amountCents: 100000,
    operationDate: "2026-07-27",
  };

  test("accepts mcp alongside the original sources", () => {
    for (const source of ["manual", "auto", "import", "mcp"]) {
      expect(createContributionLogSchema.safeParse({ ...base, source }).success).toBe(true);
    }
  });

  test("still rejects an unknown source", () => {
    expect(createContributionLogSchema.safeParse({ ...base, source: "nope" }).success).toBe(false);
  });
});
