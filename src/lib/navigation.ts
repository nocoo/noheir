import {
  LayoutDashboard,
  HeartPulse,
  Brain,
  PiggyBank,
  Target,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  GitCompare,
  Wallet,
  CreditCard,
  BarChart3,
  Lightbulb,
  Warehouse,
  Layers,
  Droplets,
  Package,
  Coins,
  Settings,
  Cpu,
  Tags,
  CalendarClock,
  FileUp,
  Database,
  KeyRound,
  type LucideIcon,
} from "lucide-react";

/** Feature flag for the 002-spec "资金计划" calendar.
 *
 * While false: the sidebar group is hidden AND /plan/calendar +
 * /plan/categories pages return 404 (P3-C9/C10 wire the page-level
 * gate). P3-C11 flips this to true as the single user-visible commit
 * for Phase 3.
 *
 * Lives in code (not env var) so prod and dev share the same value
 * and reviewer can audit it via PR. */
export const FEATURE_PLAN_CALENDAR = false;

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

/** 002-spec sidebar group — hidden behind FEATURE_PLAN_CALENDAR. */
const PLAN_NAV_GROUP: NavGroup = {
  label: "资金计划",
  defaultOpen: true,
  items: [
    { href: "/plan/calendar", label: "日历", icon: CalendarClock },
    { href: "/plan/categories", label: "分类", icon: Tags },
  ],
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "总览",
    defaultOpen: true,
    items: [
      { href: "/", label: "总览", icon: LayoutDashboard },
      { href: "/financial-health", label: "财务健康", icon: HeartPulse },
      { href: "/ai-insight", label: "AI洞察", icon: Brain },
    ],
  },
  {
    label: "现金流分析",
    defaultOpen: true,
    items: [
      { href: "/savings", label: "储蓄率", icon: PiggyBank },
      { href: "/freedom", label: "财务自由", icon: Target },
      { href: "/income", label: "收入分析", icon: TrendingUp },
      { href: "/expense", label: "支出分析", icon: TrendingDown },
      { href: "/flow", label: "流向分析", icon: ArrowRightLeft },
      { href: "/compare", label: "时段对比", icon: GitCompare },
    ],
  },
  {
    label: "账户管理",
    defaultOpen: true,
    items: [
      { href: "/account", label: "账户总览", icon: Wallet },
      { href: "/account-detail", label: "账户详情", icon: CreditCard },
    ],
  },
  {
    label: "存量资金管理",
    defaultOpen: true,
    items: [
      { href: "/capital-dashboard", label: "资金总览", icon: BarChart3 },
      { href: "/capital-decisions", label: "资金决策", icon: Lightbulb },
      { href: "/warehouse", label: "仓库视图", icon: Warehouse },
      { href: "/strategy", label: "策略透视", icon: Layers },
      { href: "/liquidity", label: "流动性梯队", icon: Droplets },
      { href: "/products", label: "产品表", icon: Package },
      { href: "/funds", label: "资金表", icon: Coins },
    ],
  },
  {
    label: "系统",
    defaultOpen: true,
    items: [
      { href: "/settings", label: "通用设置", icon: Settings },
      { href: "/ai-settings", label: "AI设置", icon: Cpu },
      { href: "/mcp-tokens", label: "MCP配置", icon: KeyRound },
      { href: "/account-types", label: "账户设置", icon: Tags },
      { href: "/import", label: "数据导入", icon: FileUp },
      { href: "/manage", label: "数据管理", icon: Database },
    ],
  },
];

// Insert the recurring-expense calendar group between "存量资金管理"
// and "系统" when the feature flag is on. Splicing here instead of
// inline in NAV_GROUPS lets the flag flip be a single-line change in
// P3-C11 without churning the surrounding group order.
if (FEATURE_PLAN_CALENDAR) {
  const systemIdx = NAV_GROUPS.findIndex((g) => g.label === "系统");
  if (systemIdx >= 0) {
    NAV_GROUPS.splice(systemIdx, 0, PLAN_NAV_GROUP);
  } else {
    NAV_GROUPS.push(PLAN_NAV_GROUP);
  }
}

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
