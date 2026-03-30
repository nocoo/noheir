import { describe, expect, it } from "bun:test";
import {
  calculateFinancialHealth,
  healthAlgorithm,
} from "@/lib/financial-health-algorithm";
import type { DomainTransaction } from "@/domain/types";

const makeTx = (
  overrides: Partial<DomainTransaction> = {},
): DomainTransaction => ({
  id: "1",
  date: "2024-01-01",
  year: 2024,
  month: 1,
  primaryCategory: "工资",
  secondaryCategory: null,
  tertiaryCategory: "月薪",
  amount: 1000,
  account: "A",
  type: "income",
  currency: "CNY",
  tags: [],
  note: null,
  ...overrides,
});

describe("financial-health-algorithm", () => {
  describe("utility functions", () => {
    it("linearRegression returns zero slope for single point", () => {
      expect(healthAlgorithm.linearRegression([1]).slope).toBe(0);
    });

    it("linearRegression calculates positive slope", () => {
      const { slope } = healthAlgorithm.linearRegression([1, 2, 3, 4, 5]);
      expect(slope).toBeCloseTo(1);
    });

    it("linearRegression handles constant data", () => {
      const { slope } = healthAlgorithm.linearRegression([5, 5, 5, 5]);
      expect(slope).toBeCloseTo(0);
    });

    it("coefficientOfVariation returns 0 for insufficient data", () => {
      expect(healthAlgorithm.coefficientOfVariation([1])).toBe(0);
    });

    it("coefficientOfVariation returns 0 for zero mean", () => {
      expect(healthAlgorithm.coefficientOfVariation([0, 0, 0])).toBe(0);
    });

    it("coefficientOfVariation calculates correctly", () => {
      // [10, 10, 10] should have CV = 0
      expect(healthAlgorithm.coefficientOfVariation([10, 10, 10])).toBeCloseTo(
        0,
      );
    });

    it("calculateHHI returns 1 for zero total income", () => {
      expect(healthAlgorithm.calculateHHI(new Map(), 0)).toBe(1);
    });

    it("calculateHHI returns 1 for single source", () => {
      const sources = new Map([["salary", 1000]]);
      expect(healthAlgorithm.calculateHHI(sources, 1000)).toBe(1);
    });

    it("calculateHHI returns 0.5 for two equal sources", () => {
      const sources = new Map([
        ["salary", 500],
        ["freelance", 500],
      ]);
      expect(healthAlgorithm.calculateHHI(sources, 1000)).toBeCloseTo(0.5);
    });
  });

  describe("growth score", () => {
    it("returns default for insufficient data", () => {
      const result = healthAlgorithm.calculateGrowthScore([
        { income: 1000, expense: 500 },
      ]);
      expect(result.score).toBe(10);
      expect(result.maxScore).toBe(20);
    });

    it("scores 20 when income grows faster than expenses", () => {
      const data = Array.from({ length: 12 }, (_, i) => ({
        income: 1000 + i * 100, // growing
        expense: 500 + i * 10, // growing slower
      }));
      const result = healthAlgorithm.calculateGrowthScore(data);
      expect(result.score).toBe(20);
      expect(result.details.interpretation).toBe("收入增长跑赢支出");
    });

    it("scores lower when expenses grow faster", () => {
      const data = Array.from({ length: 12 }, (_, i) => ({
        income: 1000,
        expense: 500 + i * 200, // growing fast
      }));
      const result = healthAlgorithm.calculateGrowthScore(data);
      expect(result.score).toBeLessThan(20);
    });
  });

  describe("rigidity score", () => {
    it("scores 25 for low fixed ratio (<30%)", () => {
      const tx = [makeTx({ type: "expense", amount: 200, tertiaryCategory: "房租" })];
      const result = healthAlgorithm.calculateRigidityScore(tx, 1000, ["房租"]);
      expect(result.score).toBe(25);
    });

    it("scores lower for high fixed ratio", () => {
      const tx = [makeTx({ type: "expense", amount: 700, tertiaryCategory: "房租" })];
      const result = healthAlgorithm.calculateRigidityScore(tx, 1000, ["房租"]);
      expect(result.score).toBeLessThanOrEqual(5);
    });

    it("handles undefined transactions", () => {
      const result = healthAlgorithm.calculateRigidityScore(undefined, 1000, []);
      expect(result.score).toBe(25); // 0 fixed / 1000 = 0%
    });

    it("scores correctly for 30-40% ratio", () => {
      const tx = [makeTx({ type: "expense", amount: 350, tertiaryCategory: "房租" })];
      const result = healthAlgorithm.calculateRigidityScore(tx, 1000, ["房租"]);
      expect(result.score).toBe(20);
    });

    it("scores correctly for 40-50% ratio", () => {
      const tx = [makeTx({ type: "expense", amount: 450, tertiaryCategory: "房租" })];
      const result = healthAlgorithm.calculateRigidityScore(tx, 1000, ["房租"]);
      expect(result.score).toBe(15);
    });

    it("scores correctly for 50-60% ratio", () => {
      const tx = [makeTx({ type: "expense", amount: 550, tertiaryCategory: "房租" })];
      const result = healthAlgorithm.calculateRigidityScore(tx, 1000, ["房租"]);
      expect(result.score).toBe(10);
    });
  });

  describe("quality score", () => {
    it("returns 0 for no income", () => {
      const result = healthAlgorithm.calculateQualityScore([]);
      expect(result.score).toBe(0);
    });

    it("scores low for single income source", () => {
      const tx = [makeTx({ primaryCategory: "工资" })];
      const result = healthAlgorithm.calculateQualityScore(tx);
      expect(result.score).toBe(3); // HHI = 1.0 > 0.85
    });

    it("scores high for diverse income", () => {
      const tx = [
        makeTx({ primaryCategory: "A", amount: 250 }),
        makeTx({ id: "2", primaryCategory: "B", amount: 250 }),
        makeTx({ id: "3", primaryCategory: "C", amount: 250 }),
        makeTx({ id: "4", primaryCategory: "D", amount: 250 }),
      ];
      const result = healthAlgorithm.calculateQualityScore(tx);
      expect(result.score).toBe(15); // HHI = 0.25 <= 0.3
    });

    it("scores medium for moderately diverse", () => {
      const tx = [
        makeTx({ primaryCategory: "A", amount: 600 }),
        makeTx({ id: "2", primaryCategory: "B", amount: 400 }),
      ];
      const result = healthAlgorithm.calculateQualityScore(tx);
      // HHI = (0.6^2 + 0.4^2) = 0.52, so score = 9
      expect(result.score).toBe(9);
    });
  });

  describe("resilience score", () => {
    it("returns default for insufficient data", () => {
      const result = healthAlgorithm.calculateResilienceScore([]);
      expect(result.score).toBe(10);
    });

    it("scores 20 for stable positive cash flow", () => {
      const data = Array.from({ length: 12 }, () => ({
        income: 1000,
        expense: 500,
      }));
      const result = healthAlgorithm.calculateResilienceScore(data);
      expect(result.score).toBe(20);
    });

    it("scores lower with frequent negative months", () => {
      const data = Array.from({ length: 10 }, (_, i) => ({
        income: 100,
        expense: i < 5 ? 200 : 50, // 50% negative months
      }));
      const result = healthAlgorithm.calculateResilienceScore(data);
      expect(result.score).toBeLessThanOrEqual(4);
    });
  });

  describe("savings score", () => {
    it("returns 0 for no data", () => {
      const result = healthAlgorithm.calculateSavingsScore([]);
      expect(result.score).toBe(0);
    });

    it("scores 20 for 30%+ rate", () => {
      const data = Array.from({ length: 6 }, () => ({
        income: 1000,
        expense: 600,
      }));
      const result = healthAlgorithm.calculateSavingsScore(data);
      expect(result.score).toBe(20);
    });

    it("scores 16 for 20-30% rate", () => {
      const data = [{ income: 1000, expense: 750 }]; // 25%
      const result = healthAlgorithm.calculateSavingsScore(data);
      expect(result.score).toBe(16);
    });

    it("scores 12 for 10-20% rate", () => {
      const data = [{ income: 1000, expense: 850 }]; // 15%
      const result = healthAlgorithm.calculateSavingsScore(data);
      expect(result.score).toBe(12);
    });

    it("scores 0 for negative savings", () => {
      const data = [{ income: 500, expense: 800 }];
      const result = healthAlgorithm.calculateSavingsScore(data);
      expect(result.score).toBe(0);
    });
  });

  describe("main calculation", () => {
    it("returns valid result with grade", () => {
      const result = calculateFinancialHealth([], [], 0, []);
      expect(result.maxScore).toBe(100);
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(["A+", "A", "B", "C", "D"]).toContain(result.grade);
    });

    it("handles non-finite totalIncome", () => {
      const result = calculateFinancialHealth(undefined, [], Number.NaN, []);
      expect(result.dimensions.rigidity.details.totalIncome).toBe(0);
    });

    it("assigns correct grades based on score", () => {
      // Build a strong scenario: good growth + low rigidity + diverse income + stable CF + good savings
      const monthlyData = Array.from({ length: 12 }, (_, i) => ({
        income: 10000 + i * 500,
        expense: 3000 + i * 100,
      }));
      const tx = [
        makeTx({ primaryCategory: "A", amount: 3000 }),
        makeTx({ id: "2", primaryCategory: "B", amount: 3000 }),
        makeTx({ id: "3", primaryCategory: "C", amount: 2000 }),
        makeTx({ id: "4", primaryCategory: "D", amount: 2000 }),
      ];
      const result = calculateFinancialHealth(tx, monthlyData, 120000, []);
      expect(result.totalScore).toBeGreaterThanOrEqual(70);
      expect(result.monthlyRegression.incomeTrend.slope).toBeGreaterThan(0);
    });

    it("handles non-array monthlyData", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = calculateFinancialHealth([], null as any, 0, []);
      expect(result.maxScore).toBe(100);
    });
  });
});
