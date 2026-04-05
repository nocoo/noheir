/**
 * Enum values enforced by the application layer.
 *
 * These match the original Supabase CHECK constraints.
 * Used for Zod validation in Worker routes and UI form selects.
 */

export const CHANNELS = [
  "招商银行",
  "平安银行",
  "微众银行",
  "支付宝",
  "招银香港",
  "光大永明",
  "中信建投",
] as const;

export const PRODUCT_CATEGORIES = [
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
] as const;

export const STRATEGIES = [
  "远期理财",
  "美元资产",
  "36存单",
  "长期理财",
  "短期理财",
  "中期理财",
  "进攻计划",
  "麻麻理财",
] as const;

export const TACTICS = [
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
] as const;

export const UNIT_STATUSES = [
  "已成立",
  "计划中",
  "筹集中",
  "已归档",
] as const;

export const CURRENCIES = [
  "CNY",
  "USD",
  "HKD",
] as const;

export const CONTRIBUTION_OPERATION_TYPES = [
  "invest",
  "withdraw",
  "adjust",
] as const;

export const CONTRIBUTION_SOURCES = [
  "manual",
  "auto",
  "import",
] as const;

// Derived types
export type Channel = (typeof CHANNELS)[number];
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type Strategy = (typeof STRATEGIES)[number];
export type Tactics = (typeof TACTICS)[number];
export type UnitStatus = (typeof UNIT_STATUSES)[number];
export type Currency = (typeof CURRENCIES)[number];
export type ContributionOperationType = (typeof CONTRIBUTION_OPERATION_TYPES)[number];
export type ContributionSource = (typeof CONTRIBUTION_SOURCES)[number];
